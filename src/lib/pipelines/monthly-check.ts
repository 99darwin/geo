import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/engines/crawler";
import { checkCitations } from "@/lib/engines/citation-checker";
import { extractSources } from "@/lib/engines/source-extractor";
import { calculateVisibilityScore } from "@/lib/engines/scoring";
import { auditRobotsTxt } from "@/lib/engines/robots-auditor";
import { generateLlmsTxt } from "@/lib/engines/generators/llms-txt";
import { generateSchemaScript } from "@/lib/engines/generators/schema-jsonld";
import { checkNap } from "@/lib/engines/nap-checker";
import { pullReviews } from "@/lib/engines/review-puller";
import { detectCompetitors } from "@/lib/engines/competitor-detector";
import { isBlockedUrl } from "@/lib/url-validation";
import Redis from "ioredis";
import type { AiPlatform } from "@/types/platforms";
import type { MonthlyCheckResult } from "@/types";

const ALL_PLATFORMS: AiPlatform[] = ["chatgpt", "perplexity", "gemini"];

const VALID_PLANS = ["starter", "growth"];
const VALID_STATUSES = ["setup_complete", "active"];

const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes — must exceed max pipeline duration

/** Acquire a Redis SETNX lock. Returns a release function, or null if lock not acquired. */
async function acquireLock(key: string): Promise<(() => Promise<void>) | null> {
  const url = process.env.REDIS_URL;
  if (!url) return async () => {}; // No Redis — no distributed lock, proceed anyway

  let redis: Redis | null = null;
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    const result = await redis.set(key, "1", "PX", LOCK_TTL_MS, "NX");
    if (result !== "OK") {
      await redis.disconnect();
      return null; // Lock already held
    }
    const conn = redis;
    return async () => {
      await conn.del(key).catch(() => {});
      await conn.disconnect();
    };
  } catch {
    if (redis) {
      try { redis.disconnect(); } catch { /* ignore */ }
    }
    return async () => {}; // Redis unavailable — proceed without lock
  }
}

/**
 * Monthly check pipeline — re-checks visibility for an active subscriber.
 *
 * Idempotent via period-based deduplication: if a VisibilityScore already
 * exists for this clientId + current month, returns early with existing data.
 * Does NOT delete old citations — all records are historical/append-only.
 */
export async function runMonthlyCheck(clientId: string): Promise<MonthlyCheckResult> {
  console.log("[Monthly Check] Starting for client:", clientId);

  // Step 1: Load client and validate eligibility
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  if (!VALID_PLANS.includes(client.plan ?? "")) {
    throw new Error(`[Monthly Check] Skipping client ${clientId}: plan "${client.plan}" not eligible`);
  }

  if (!VALID_STATUSES.includes(client.onboardingStatus)) {
    throw new Error(`[Monthly Check] Skipping client ${clientId}: onboardingStatus "${client.onboardingStatus}" not eligible`);
  }

  // Step 2: Compute period and check idempotency
  const now = new Date();
  const period = new Date(now.getFullYear(), now.getMonth(), 1);

  // Acquire distributed lock to prevent concurrent runs for the same client
  const lockKey = `lock:monthly-check:${clientId}`;
  const releaseLock = await acquireLock(lockKey);
  if (releaseLock === null) {
    console.log("[Monthly Check] Another run in progress for this client, skipping");
    const existing = await prisma.visibilityScore.findFirst({
      where: { clientId },
      orderBy: { period: "desc" },
    });
    return {
      clientId,
      newScore: existing?.score ?? 0,
      previousScore: null,
      delta: 0,
      filesRegenerated: false,
      citationsChecked: 0,
    };
  }

  try {

  const existingScore = await prisma.visibilityScore.findUnique({
    where: { clientId_period: { clientId, period } },
  });

  if (existingScore) {
    console.log("[Monthly Check] Already ran for this period, returning existing score");

    // Find previous period score for delta
    const previousScore = await prisma.visibilityScore.findFirst({
      where: { clientId, period: { lt: period } },
      orderBy: { period: "desc" },
    });

    return {
      clientId,
      newScore: existingScore.score,
      previousScore: previousScore?.score ?? null,
      delta: existingScore.score - (previousScore?.score ?? existingScore.score),
      filesRegenerated: false,
      citationsChecked: 0,
    };
  }

  // SSRF validation
  if (isBlockedUrl(client.websiteUrl)) {
    throw new Error(`[Monthly Check] Blocked URL: ${client.websiteUrl}`);
  }

  // Step 3: Re-crawl site
  console.log("[Monthly Check] Crawling:", client.websiteUrl);
  const crawlResult = await crawlSite(client.websiteUrl);

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

  // Step 4: Conditionally regenerate files
  let filesRegenerated = false;

  const newLlmsTxt = generateLlmsTxt(
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

  const newSchemaScript = generateSchemaScript({
    businessName: updatedClient.businessName,
    address: updatedClient.address ?? undefined,
    city: updatedClient.city,
    state: updatedClient.state ?? undefined,
    phone: updatedClient.phone ?? undefined,
    websiteUrl: updatedClient.websiteUrl,
    hours: updatedClient.hours ?? undefined,
    googleBusinessUrl: updatedClient.googleBusinessUrl ?? undefined,
  });

  // Compare and conditionally update llms.txt
  const currentLlmsTxt = await prisma.generatedFile.findFirst({
    where: { clientId, fileType: "llms_txt", isActive: true },
  });

  if (!currentLlmsTxt || currentLlmsTxt.content !== newLlmsTxt) {
    console.log("[Monthly Check] llms.txt changed, regenerating");
    await prisma.generatedFile.updateMany({
      where: { clientId, fileType: "llms_txt", isActive: true },
      data: { isActive: false },
    });

    const maxVersion = await prisma.generatedFile.aggregate({
      where: { clientId, fileType: "llms_txt" },
      _max: { version: true },
    });

    await prisma.generatedFile.create({
      data: {
        clientId,
        fileType: "llms_txt",
        content: newLlmsTxt,
        version: (maxVersion._max.version ?? 0) + 1,
        isActive: true,
      },
    });

    filesRegenerated = true;
  }

  // Compare and conditionally update schema JSON
  const currentSchema = await prisma.generatedFile.findFirst({
    where: { clientId, fileType: "schema_json", isActive: true },
  });

  if (!currentSchema || currentSchema.content !== newSchemaScript) {
    console.log("[Monthly Check] schema changed, regenerating");
    await prisma.generatedFile.updateMany({
      where: { clientId, fileType: "schema_json", isActive: true },
      data: { isActive: false },
    });

    const maxVersion = await prisma.generatedFile.aggregate({
      where: { clientId, fileType: "schema_json" },
      _max: { version: true },
    });

    await prisma.generatedFile.create({
      data: {
        clientId,
        fileType: "schema_json",
        content: newSchemaScript,
        version: (maxVersion._max.version ?? 0) + 1,
        isActive: true,
      },
    });

    filesRegenerated = true;
  }

  // Step 5: Re-audit robots.txt
  console.log("[Monthly Check] Auditing robots.txt");
  const robotsAudit = await auditRobotsTxt(updatedClient.websiteUrl);

  // Step 6: Load active queries (do NOT regenerate)
  const queryRecords = await prisma.query.findMany({
    where: { clientId, active: true },
  });

  if (queryRecords.length === 0) {
    throw new Error(`[Monthly Check] No active queries found for client ${clientId}`);
  }

  const queryTexts = queryRecords.map((q) => q.queryText);

  // Step 7: Run citation checks
  console.log("[Monthly Check] Running citation checks for", queryTexts.length, "queries");
  const citationResults = await checkCitations({
    queries: queryTexts,
    businessName: updatedClient.businessName,
    platforms: ALL_PLATFORMS,
    runsPerQuery: 3,
  });

  // Step 8: Store new citations (append-only, no deletion of old records)
  const allCitationSources: { domain: string; url?: string | null; platform: AiPlatform }[] = [];
  let citedQueryCount = 0;
  const platformsCiting = new Set<AiPlatform>();
  const allCitationPositions: { position: number | null }[] = [];
  const citationResponses: { query: string; platform: string; rawResponse: string; sourcesCited: { domain: string; url: string | null }[] }[] = [];
  let citationsChecked = 0;

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

      citationsChecked++;

      if (result.cited) {
        queryWasCited = true;
        platformsCiting.add(platform);
      }

      allCitationPositions.push({ position: result.position ?? null });

      // Collect raw responses for competitor detection + source extraction
      if (result.rawResponse) {
        citationResponses.push({ query: queryText, platform, rawResponse: result.rawResponse, sourcesCited: result.sourcesCited ?? [] });

        const sources = extractSources(result.rawResponse, platform);
        for (const source of sources) {
          allCitationSources.push({ ...source, platform });
        }
      }
    }

    if (queryWasCited) citedQueryCount++;
  }

  // Step 9: NAP check + review pull (graceful failure)
  console.log("[Monthly Check] Running NAP check + review pull");
  const [napResult, reviewResult] = await Promise.allSettled([
    checkNap({
      businessName: updatedClient.businessName,
      address: updatedClient.address ?? undefined,
      phone: updatedClient.phone ?? undefined,
      city: updatedClient.city,
      state: updatedClient.state ?? undefined,
    }),
    pullReviews({
      businessName: updatedClient.businessName,
      city: updatedClient.city,
      state: updatedClient.state ?? undefined,
    }),
  ]);

  // Store NAP results
  if (napResult.status === "fulfilled") {
    await Promise.all(
      napResult.value.map(async (nap) => {
        const existing = await prisma.napAudit.findFirst({
          where: { clientId, platform: nap.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook" },
          orderBy: { checkedAt: "desc" },
        });
        // Skip if already checked today
        if (existing && existing.checkedAt.toDateString() === new Date().toDateString()) return;
        await prisma.napAudit.create({
          data: {
            clientId,
            platform: nap.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook",
            nameMatch: nap.nameMatch,
            addressMatch: nap.addressMatch,
            phoneMatch: nap.phoneMatch,
            listingUrl: nap.listingUrl ?? null,
            issues: nap.issues,
          },
        });
      })
    );
  } else {
    console.warn("[Monthly Check] NAP check failed:", napResult.reason);
  }

  // Store review snapshots
  if (reviewResult.status === "fulfilled") {
    await Promise.all(
      reviewResult.value.map(async (review) => {
        const existing = await prisma.reviewSnapshot.findFirst({
          where: { clientId, platform: review.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook" },
          orderBy: { checkedAt: "desc" },
        });
        // Skip if already checked today
        if (existing && existing.checkedAt.toDateString() === new Date().toDateString()) return;
        await prisma.reviewSnapshot.create({
          data: {
            clientId,
            platform: review.platform as "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook",
            rating: review.rating,
            reviewCount: review.reviewCount,
          },
        });
      })
    );
  } else {
    console.warn("[Monthly Check] Review pull failed:", reviewResult.reason);
  }

  // Step 10: Competitor detection from citation responses
  console.log("[Monthly Check] Running competitor detection");
  if (citationResponses.length > 0) {
    const detectedCompetitors = await detectCompetitors({
      businessName: updatedClient.businessName,
      citationResponses,
    });

    for (const comp of detectedCompetitors) {
      // Upsert competitor record — don't create duplicates
      let competitor = await prisma.competitor.findFirst({
        where: { clientId, competitorName: comp.name },
      });

      if (!competitor) {
        competitor = await prisma.competitor.create({
          data: {
            clientId,
            competitorName: comp.name,
            competitorUrl: comp.domain ?? null,
            isAutoDetected: true,
          },
        });
      }

      // Store competitor citations — skip duplicates for same (competitor, query, platform)
      for (const queryText of comp.citedInQueries) {
        const queryRecord = queryRecords.find((q) => q.queryText === queryText);
        if (!queryRecord) continue;

        for (const platform of comp.platforms) {
          const existing = await prisma.competitorCitation.findFirst({
            where: {
              competitorId: competitor.id,
              queryId: queryRecord.id,
              platform: platform as AiPlatform,
            },
          });
          if (existing) continue;

          await prisma.competitorCitation.create({
            data: {
              competitorId: competitor.id,
              queryId: queryRecord.id,
              platform: platform as AiPlatform,
              cited: true,
            },
          });
        }
      }
    }
  }

  // Step 11: Extract + store industry sources
  console.log("[Monthly Check] Storing industry sources");
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
    Array.from(sourceMap.values()).map(async (source) => {
      const existing = await prisma.industrySource.findFirst({
        where: { clientId, domain: source.domain, period },
      });
      if (existing) {
        await prisma.industrySource.update({
          where: { id: existing.id },
          data: {
            citationCount: source.count,
            platformsCiting: Array.from(source.platforms),
            url: source.url ?? existing.url,
          },
        });
      } else {
        await prisma.industrySource.create({
          data: {
            clientId,
            domain: source.domain,
            url: source.url ?? null,
            citationCount: source.count,
            platformsCiting: Array.from(source.platforms),
            period,
          },
        });
      }
    })
  );

  // Step 12: Compute visibility score
  console.log("[Monthly Check] Computing visibility score");
  const [activeLlmsTxt, activeSchema] = await Promise.all([
    prisma.generatedFile.findFirst({
      where: { clientId, fileType: "llms_txt", isActive: true },
      select: { id: true },
    }),
    prisma.generatedFile.findFirst({
      where: { clientId, fileType: "schema_json", isActive: true },
      select: { id: true },
    }),
  ]);

  const scoreResult = calculateVisibilityScore({
    citedQueries: citedQueryCount,
    totalQueries: queryTexts.length,
    platformsCiting: platformsCiting.size,
    totalPlatforms: ALL_PLATFORMS.length,
    citations: allCitationPositions,
    hasLlmsTxt: !!activeLlmsTxt,
    hasSchema: !!activeSchema,
    hasCleanRobotsTxt: robotsAudit.blocked.length === 0,
  });

  // Step 13: Detect deltas — compare with previous period
  const previousPeriodScore = await prisma.visibilityScore.findFirst({
    where: { clientId, period: { lt: period } },
    orderBy: { period: "desc" },
  });

  // Build delta info for breakdown
  const previousCitations = previousPeriodScore
    ? await prisma.citation.findMany({
        where: {
          clientId,
          checkedAt: {
            gte: new Date(
              new Date(period).setMonth(period.getMonth() - 1)
            ),
            lt: period,
          },
        },
        include: { query: true },
      })
    : [];

  // Determine newly cited and lost (query, platform) pairs
  const previousCitedPairs = new Set(
    previousCitations
      .filter((c) => c.cited)
      .map((c) => `${c.query.queryText}:::${c.platform}`)
  );

  const currentCitedPairs = new Map<string, { query: string; platform: string }>();
  for (const [queryText, platformMap] of citationResults) {
    for (const [platform, result] of platformMap) {
      if (result.cited) {
        currentCitedPairs.set(`${queryText}:::${platform}`, { query: queryText, platform });
      }
    }
  }

  const newlyCited = [...currentCitedPairs.entries()]
    .filter(([key]) => !previousCitedPairs.has(key))
    .map(([, val]) => val);

  const lostCitations = [...previousCitedPairs]
    .filter((key) => !currentCitedPairs.has(key))
    .map((key) => {
      const [query, platform] = key.split(":::");
      return { query, platform };
    });

  const delta = scoreResult.total - (previousPeriodScore?.score ?? scoreResult.total);

  const breakdownWithDelta = {
    ...scoreResult,
    delta: {
      scoreChange: delta,
      previousScore: previousPeriodScore?.score ?? null,
      newlyCited,
      lostCitations,
    },
  };

  await prisma.visibilityScore.upsert({
    where: { clientId_period: { clientId, period } },
    create: {
      clientId,
      score: scoreResult.total,
      queryCoverage: Math.round(scoreResult.queryCoverage * 100),
      platformCoverage: Math.round(scoreResult.platformCoverage * 100),
      period,
      breakdown: JSON.parse(JSON.stringify(breakdownWithDelta)),
    },
    update: {
      score: scoreResult.total,
      queryCoverage: Math.round(scoreResult.queryCoverage * 100),
      platformCoverage: Math.round(scoreResult.platformCoverage * 100),
      breakdown: JSON.parse(JSON.stringify(breakdownWithDelta)),
    },
  });

  // Step 14: Update onboarding status if still setup_complete
  if (updatedClient.onboardingStatus === "setup_complete") {
    await prisma.client.update({
      where: { id: clientId },
      data: { onboardingStatus: "active" },
    });
  }

  console.log("[Monthly Check] Complete for client:", clientId);

  // Step 15: Return result
  return {
    clientId,
    newScore: scoreResult.total,
    previousScore: previousPeriodScore?.score ?? null,
    delta,
    filesRegenerated,
    citationsChecked,
  };

  } finally {
    await releaseLock();
  }
}
