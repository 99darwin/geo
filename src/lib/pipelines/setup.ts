import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/engines/crawler";
import { generateQueries } from "@/lib/engines/query-generator";
import { checkCitations } from "@/lib/engines/citation-checker";
import { extractSources } from "@/lib/engines/source-extractor";
import { calculateVisibilityScore } from "@/lib/engines/scoring";
import { auditRobotsTxt } from "@/lib/engines/robots-auditor";
import { generateLlmsTxt, generateEnrichedAbout, isLlmsTxtQualitySufficient } from "@/lib/engines/generators/llms-txt";
import { generateSchemaScript } from "@/lib/engines/generators/schema-jsonld";
import { checkNap } from "@/lib/engines/nap-checker";
import { pullReviews } from "@/lib/engines/review-puller";
import { detectCompetitors } from "@/lib/engines/competitor-detector";
import { enrichBusinessInfo } from "@/lib/engines/business-enricher";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";
import { isBlockedUrl } from "@/lib/url-validation";
import type { AiPlatform } from "@/types/platforms";

const ALL_PLATFORMS: AiPlatform[] = ["chatgpt", "perplexity", "gemini"];

/**
 * Full setup pipeline — runs after checkout.session.completed.
 * Crawls the site, generates files, checks citations, computes score.
 *
 * Idempotent: uses atomic claim on onboardingStatus to prevent concurrent runs,
 * and cleans up existing records before re-creating them on retries.
 */
const STALE_RUNNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function runSetupPipeline(clientId: string): Promise<void> {
  console.log("[Setup Pipeline] Starting for client:", clientId);

  // First try: claim setup_pending → setup_running
  let claimed = await prisma.client.updateMany({
    where: { id: clientId, onboardingStatus: "setup_pending" },
    data: { onboardingStatus: "setup_running" },
  });

  if (claimed.count === 0) {
    // If stuck in setup_running (process was killed, catch never ran),
    // reclaim if it's been stale for over 10 minutes.
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { onboardingStatus: true, updatedAt: true },
    });

    if (
      client?.onboardingStatus === "setup_running" &&
      Date.now() - client.updatedAt.getTime() > STALE_RUNNING_THRESHOLD_MS
    ) {
      console.log("[Setup Pipeline] Reclaiming stale setup_running for client:", clientId);
      // Atomic reclaim: reset to setup_pending, then re-claim below won't race
      // because only one process can win the setup_running → setup_pending transition
      // (updatedAt filter ensures we only match the stale row).
      const staleThreshold = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS);
      await prisma.client.updateMany({
        where: { id: clientId, onboardingStatus: "setup_running", updatedAt: { lt: staleThreshold } },
        data: { onboardingStatus: "setup_pending" },
      });
      // Now attempt the normal pending → running claim
      claimed = await prisma.client.updateMany({
        where: { id: clientId, onboardingStatus: "setup_pending" },
        data: { onboardingStatus: "setup_running" },
      });
    }

    if (claimed.count === 0) {
      console.log("[Setup Pipeline] Already claimed or completed for client:", clientId);
      return;
    }
  }

  try {
    await executeSetupSteps(clientId);
  } catch (error) {
    // On failure, revert to setup_pending so retries can re-claim
    await prisma.client.update({
      where: { id: clientId },
      data: { onboardingStatus: "setup_pending" },
    });
    throw error;
  }
}

async function executeSetupSteps(clientId: string): Promise<void> {
  // Step 1: Load client
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  // SSRF validation — block private/internal URLs
  if (isBlockedUrl(client.websiteUrl)) {
    throw new Error(`Blocked URL: ${client.websiteUrl}`);
  }

  // Clean up any partial data from a previous interrupted run
  await cleanupPreviousRun(clientId);

  // Step 2: Crawl site
  console.log("[Setup Pipeline] Crawling:", client.websiteUrl);
  const crawlResult = await crawlSite(client.websiteUrl);

  // Step 2.5: AI enrichment if crawl data is sparse
  let enrichedData: { businessName?: string; category?: string; city?: string; state?: string; services?: string[]; about?: string; serviceArea?: string } = {};
  if (!crawlResult.category || !crawlResult.city || crawlResult.services.length === 0 || !crawlResult.about) {
    console.log("[Setup Pipeline] Crawl data sparse, running AI enrichment");
    try {
      const enriched = await enrichBusinessInfo({ rawContent: crawlResult.rawContent, url: client.websiteUrl });
      enrichedData = {
        businessName: enriched.businessName,
        category: enriched.category,
        city: enriched.city ?? undefined,
        state: enriched.state ?? undefined,
        services: enriched.services,
        about: enriched.about,
        serviceArea: enriched.serviceArea,
      };
    } catch (err) {
      console.warn("[Setup Pipeline] AI enrichment failed:", err instanceof Error ? err.message : err);
    }
  }

  // Step 3: Update client with crawled data (priority: user-provided > crawl > enriched > existing)
  // Business name: if it looks like a domain (no spaces), prefer crawl/enriched over it
  const isLikelyDomainName = !client.businessName.includes(" ");
  await prisma.client.update({
    where: { id: clientId },
    data: {
      businessName: isLikelyDomainName
        ? (crawlResult.businessName || enrichedData.businessName || client.businessName)
        : client.businessName,
      city: client.city || crawlResult.city || enrichedData.city || null,
      state: client.state || crawlResult.state || enrichedData.state || null,
      phone: crawlResult.phone || client.phone,
      address: crawlResult.address || client.address,
      category: client.category || crawlResult.category || enrichedData.category || null,
      services: client.services.length > 0 ? client.services : (crawlResult.services.length > 0 ? crawlResult.services : (enrichedData.services || [])),
      hours: crawlResult.hours || client.hours,
      serviceArea: client.serviceArea || enrichedData.serviceArea || "local",
    },
  });

  const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  // Step 4: Generate llms.txt
  console.log("[Setup Pipeline] Generating llms.txt");
  const crawlDataForLlms = {
    description: crawlResult.description ?? undefined,
    about: crawlResult.about || enrichedData.about || undefined,
    keyPages: crawlResult.keyPages,
  };

  // Use AI-enhanced about if quality is insufficient
  if (!isLlmsTxtQualitySufficient(
    { businessName: updatedClient.businessName, city: updatedClient.city ?? undefined, services: updatedClient.services },
    { about: crawlDataForLlms.about }
  ) && crawlResult.rawContent) {
    try {
      const enrichedAbout = await generateEnrichedAbout({
        businessName: updatedClient.businessName,
        category: updatedClient.category ?? undefined,
        services: updatedClient.services,
        rawContent: crawlResult.rawContent,
        websiteUrl: updatedClient.websiteUrl,
      });
      crawlDataForLlms.about = enrichedAbout;
    } catch (err) {
      console.warn("[Setup Pipeline] AI about generation failed:", err instanceof Error ? err.message : err);
    }
  }

  const llmsTxt = generateLlmsTxt(
    {
      businessName: updatedClient.businessName,
      category: updatedClient.category ?? undefined,
      city: updatedClient.city ?? undefined,
      state: updatedClient.state ?? undefined,
      phone: updatedClient.phone ?? undefined,
      address: updatedClient.address ?? undefined,
      services: updatedClient.services,
      hours: updatedClient.hours ?? undefined,
      websiteUrl: updatedClient.websiteUrl,
      serviceArea: updatedClient.serviceArea ?? undefined,
    },
    crawlDataForLlms
  );

  await prisma.generatedFile.create({
    data: {
      clientId,
      fileType: "llms_txt",
      content: llmsTxt,
      version: 1,
      isActive: true,
    },
  });

  // Step 5: Generate JSON-LD schema
  console.log("[Setup Pipeline] Generating JSON-LD schema");
  const schemaScript = generateSchemaScript({
    businessName: updatedClient.businessName,
    address: updatedClient.address ?? undefined,
    city: updatedClient.city ?? "",
    state: updatedClient.state ?? undefined,
    phone: updatedClient.phone ?? undefined,
    websiteUrl: updatedClient.websiteUrl,
    hours: updatedClient.hours ?? undefined,
    googleBusinessUrl: updatedClient.googleBusinessUrl ?? undefined,
  });

  await prisma.generatedFile.create({
    data: {
      clientId,
      fileType: "schema_json",
      content: schemaScript,
      version: 1,
      isActive: true,
    },
  });

  // Step 6: Audit robots.txt
  console.log("[Setup Pipeline] Auditing robots.txt");
  const robotsAudit = await auditRobotsTxt(updatedClient.websiteUrl);
  console.log("[Setup Pipeline] Robots.txt audit:", {
    accessible: robotsAudit.accessible,
    blocked: robotsAudit.blocked,
    total: robotsAudit.total,
  });

  // Step 7: Generate queries
  console.log("[Setup Pipeline] Generating queries");
  const queries = await generateQueries({
    category: updatedClient.category || "Local Business",
    city: updatedClient.city || undefined,
    services: updatedClient.services,
    serviceArea: (updatedClient.serviceArea as "local" | "regional" | "national" | "global") || "local",
    count: 12,
  });

  const queryRecords = await Promise.all(
    queries.map((queryText) =>
      prisma.query.create({
        data: {
          clientId,
          queryText,
          isAutoGenerated: true,
          active: true,
        },
      })
    )
  );

  console.log("[Setup Pipeline] Created", queryRecords.length, "queries");

  // Step 8: Citation checks across all platforms
  console.log("[Setup Pipeline] Running citation checks");
  const citationResults = await checkCitations({
    queries,
    businessName: updatedClient.businessName,
    platforms: ALL_PLATFORMS,
    runsPerQuery: 3,
  });

  // Store citations in DB
  const allCitationSources: { domain: string; url?: string | null; platform: AiPlatform }[] = [];
  let citedQueryCount = 0;
  const platformsCiting = new Set<AiPlatform>();
  const allCitationPositions: { position: number | null }[] = [];

  for (const [queryText, platformMap] of citationResults) {
    const queryRecord = queryRecords.find((q) => q.queryText === queryText);
    if (!queryRecord) continue;

    let queryWasCited = false;

    for (const [platform, result] of platformMap) {
      await prisma.citation.create({
        data: {
          clientId,
          queryId: queryRecord.id,
          platform,
          cited: result.cited,
          position: result.position ?? null,
          sentiment: result.sentiment ?? null,
          rawResponse: result.rawResponse ?? null,
          sourcesCited: result.sourcesCited ?? [],
        },
      });

      if (result.cited) {
        queryWasCited = true;
        platformsCiting.add(platform);
      }

      allCitationPositions.push({ position: result.position ?? null });

      // Extract sources from this response
      if (result.rawResponse) {
        const sources = extractSources(result.rawResponse, platform);
        for (const source of sources) {
          allCitationSources.push({ ...source, platform });
        }
      }
    }

    if (queryWasCited) citedQueryCount++;
  }

  // Step 9: Store industry sources
  console.log("[Setup Pipeline] Storing industry sources");
  const period = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const sourceMap = new Map<string, { domain: string; url?: string | null; count: number; platforms: Set<AiPlatform> }>();

  for (const source of allCitationSources) {
    const existing = sourceMap.get(source.domain);
    if (existing) {
      existing.count++;
      existing.platforms.add(source.platform);
      if (source.url && !existing.url) existing.url = source.url;
    } else {
      sourceMap.set(source.domain, {
        domain: source.domain,
        url: source.url,
        count: 1,
        platforms: new Set([source.platform]),
      });
    }
  }

  await Promise.all(
    Array.from(sourceMap.values()).map((source) =>
      prisma.industrySource.create({
        data: {
          clientId,
          domain: source.domain,
          url: source.url ?? null,
          citationCount: source.count,
          platformsCiting: Array.from(source.platforms),
          period,
        },
      })
    )
  );

  // Steps 10-12: NAP audit, review snapshot, competitor detection
  console.log("[Setup Pipeline] Running NAP audit, reviews, competitor detection");

  const isLocal = updatedClient.serviceArea === "local" || !updatedClient.serviceArea;

  const settledPromises = await Promise.allSettled([
    ...(isLocal ? [checkNap({
      businessName: updatedClient.businessName,
      address: updatedClient.address ?? undefined,
      phone: updatedClient.phone ?? undefined,
      city: updatedClient.city ?? "",
      state: updatedClient.state ?? undefined,
    })] : []),
    pullReviews({
      businessName: updatedClient.businessName,
      city: updatedClient.city ?? "",
      state: updatedClient.state ?? undefined,
    }),
  ]);

  // Adjust result indices based on whether NAP was included
  const napResult = isLocal ? settledPromises[0] : null;
  const reviewResult = isLocal ? settledPromises[1] : settledPromises[0];

  if (napResult?.status === "fulfilled" && (napResult.value as Awaited<ReturnType<typeof checkNap>>).length > 0) {
    const napValues = napResult.value as Awaited<ReturnType<typeof checkNap>>;
    await prisma.napAudit.createMany({
      data: napValues.map((r) => ({
        clientId,
        platform: r.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook",
        nameMatch: r.nameMatch,
        addressMatch: r.addressMatch,
        phoneMatch: r.phoneMatch,
        listingUrl: r.listingUrl ?? null,
        issues: r.issues,
      })),
    });
  }

  if (reviewResult?.status === "fulfilled") {
    const reviewValues = reviewResult.value as Awaited<ReturnType<typeof pullReviews>>;
    if (reviewValues.length > 0) {
      await prisma.reviewSnapshot.createMany({
        data: reviewValues.map((r) => ({
          clientId,
          platform: r.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook",
          rating: r.rating,
          reviewCount: r.reviewCount,
        })),
      });
    }
  }

  // Competitor detection from citation responses
  const citationResponsesForDetection = Array.from(citationResults).flatMap(
    ([queryText, platformMap]) =>
      Array.from(platformMap)
        .filter(([, result]) => !!result.rawResponse)
        .map(([platform, result]) => ({
          query: queryText,
          platform,
          rawResponse: result.rawResponse as string,
          sourcesCited: result.sourcesCited ?? [],
        }))
  );

  const manualCompetitors = await prisma.competitor.findMany({
    where: { clientId, isAutoDetected: false },
  });

  if (manualCompetitors.length < 3 && citationResponsesForDetection.length > 0) {
    const detectedCompetitors = await detectCompetitors({
      businessName: updatedClient.businessName,
      category: updatedClient.category ?? undefined,
      citationResponses: citationResponsesForDetection,
    });

    for (const comp of detectedCompetitors.slice(0, 5)) {
      const isDuplicate = manualCompetitors.some(mc =>
        isBusinessMentioned(comp.name, mc.competitorName).cited
      );
      if (isDuplicate) continue;

      await prisma.competitor.create({
        data: {
          clientId,
          competitorName: comp.name,
          competitorUrl: comp.domain ? `https://${comp.domain}` : null,
          isAutoDetected: true,
        },
      });
    }
  } else if (manualCompetitors.length >= 3) {
    console.log("[Setup Pipeline] Skipping auto-detection — user provided 3+ competitors");
  }

  // Step 14: Compute visibility score (upsert to handle retries)
  console.log("[Setup Pipeline] Computing visibility score");
  const scoreResult = calculateVisibilityScore({
    citedQueries: citedQueryCount,
    totalQueries: queries.length,
    platformsCiting: platformsCiting.size,
    totalPlatforms: ALL_PLATFORMS.length,
    citations: allCitationPositions,
    hasLlmsTxt: true,
    hasSchema: true,
    hasCleanRobotsTxt: robotsAudit.blocked.length === 0,
  });

  await prisma.visibilityScore.upsert({
    where: { clientId_period: { clientId, period } },
    create: {
      clientId,
      score: scoreResult.total,
      queryCoverage: Math.round(scoreResult.queryCoverage * 100),
      platformCoverage: Math.round(scoreResult.platformCoverage * 100),
      period,
      breakdown: JSON.parse(JSON.stringify(scoreResult)),
    },
    update: {
      score: scoreResult.total,
      queryCoverage: Math.round(scoreResult.queryCoverage * 100),
      platformCoverage: Math.round(scoreResult.platformCoverage * 100),
      breakdown: JSON.parse(JSON.stringify(scoreResult)),
    },
  });

  // Step 15: Update onboarding status
  await prisma.client.update({
    where: { id: clientId },
    data: { onboardingStatus: "setup_complete" },
  });

  console.log("[Setup Pipeline] Complete for client:", clientId);
}

/**
 * Remove data from a previous interrupted pipeline run so we start clean.
 */
async function cleanupPreviousRun(clientId: string): Promise<void> {
  const [existingFiles, existingQueries] = await Promise.all([
    prisma.generatedFile.count({ where: { clientId } }),
    prisma.query.count({ where: { clientId } }),
  ]);

  if (existingFiles === 0 && existingQueries === 0) return;

  console.log("[Setup Pipeline] Cleaning up previous run for client:", clientId);

  // Delete in dependency order: competitor citations reference competitors and queries
  await prisma.competitorCitation.deleteMany({
    where: { competitor: { clientId, isAutoDetected: true } },
  });
  await prisma.competitor.deleteMany({ where: { clientId, isAutoDetected: true } });
  await prisma.napAudit.deleteMany({ where: { clientId } });
  await prisma.reviewSnapshot.deleteMany({ where: { clientId } });
  await prisma.citation.deleteMany({ where: { clientId } });
  await prisma.query.deleteMany({ where: { clientId } });
  await prisma.generatedFile.deleteMany({ where: { clientId } });
  await prisma.industrySource.deleteMany({ where: { clientId } });
  await prisma.visibilityScore.deleteMany({ where: { clientId } });
}
