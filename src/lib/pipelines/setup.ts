import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/engines/crawler";
import { generateQueries } from "@/lib/engines/query-generator";
import { checkCitations } from "@/lib/engines/citation-checker";
import { extractSources } from "@/lib/engines/source-extractor";
import { calculateVisibilityScore } from "@/lib/engines/scoring";
import { auditRobotsTxt } from "@/lib/engines/robots-auditor";
import { generateLlmsTxt } from "@/lib/engines/generators/llms-txt";
import { generateSchemaScript } from "@/lib/engines/generators/schema-jsonld";
import type { AiPlatform } from "@/types/platforms";

const ALL_PLATFORMS: AiPlatform[] = ["chatgpt", "perplexity", "gemini"];

/**
 * Full setup pipeline — runs after checkout.session.completed.
 * Crawls the site, generates files, checks citations, computes score.
 *
 * Idempotent: uses atomic claim on onboardingStatus to prevent concurrent runs,
 * and cleans up existing records before re-creating them on retries.
 */
export async function runSetupPipeline(clientId: string): Promise<void> {
  console.log("[Setup Pipeline] Starting for client:", clientId);

  // Atomic claim: only one process can transition setup_pending → setup_running.
  // If another process already claimed it, bail out.
  const claimed = await prisma.client.updateMany({
    where: { id: clientId, onboardingStatus: "setup_pending" },
    data: { onboardingStatus: "setup_running" },
  });

  if (claimed.count === 0) {
    console.log("[Setup Pipeline] Already claimed or completed for client:", clientId);
    return;
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

  // Clean up any partial data from a previous interrupted run
  await cleanupPreviousRun(clientId);

  // Step 2: Crawl site
  console.log("[Setup Pipeline] Crawling:", client.websiteUrl);
  const crawlResult = await crawlSite(client.websiteUrl);

  // Step 3: Update client with crawled data
  await prisma.client.update({
    where: { id: clientId },
    data: {
      businessName: crawlResult.businessName || client.businessName,
      city: crawlResult.city || client.city,
      state: crawlResult.state || client.state,
      phone: crawlResult.phone || client.phone,
      address: crawlResult.address || client.address,
      category: crawlResult.category || client.category,
      services: crawlResult.services.length > 0 ? crawlResult.services : client.services,
      hours: crawlResult.hours || client.hours,
    },
  });

  const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  // Step 4: Generate llms.txt
  console.log("[Setup Pipeline] Generating llms.txt");
  const llmsTxt = generateLlmsTxt(
    {
      businessName: updatedClient.businessName,
      category: updatedClient.category ?? undefined,
      city: updatedClient.city,
      state: updatedClient.state ?? undefined,
      phone: updatedClient.phone ?? undefined,
      address: updatedClient.address ?? undefined,
      services: updatedClient.services,
      hours: updatedClient.hours ?? undefined,
      websiteUrl: updatedClient.websiteUrl,
    },
    {
      description: crawlResult.description ?? undefined,
      about: crawlResult.about ?? undefined,
      keyPages: crawlResult.keyPages,
    }
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
    city: updatedClient.city,
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
    city: updatedClient.city || "the area",
    services: updatedClient.services,
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

  // Steps 10-13: NAP audit, review snapshot, competitor detection — skipped for MVP
  console.log("[Setup Pipeline] Skipping NAP audit, reviews, competitors (MVP)");

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

  // Delete in dependency order: citations reference queries
  await prisma.citation.deleteMany({ where: { clientId } });
  await prisma.query.deleteMany({ where: { clientId } });
  await prisma.generatedFile.deleteMany({ where: { clientId } });
  await prisma.industrySource.deleteMany({ where: { clientId } });
  await prisma.visibilityScore.deleteMany({ where: { clientId } });
}
