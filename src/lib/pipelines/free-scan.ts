import type {
  CrawlResult,
  CitationResult,
  ScanResult,
  ScoreBreakdown,
  ExtractedSource,
} from "@/types";
import type { AiPlatform } from "@/types/platforms";
import { withTimeout, normalizeDomain } from "@/lib/utils";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";

const FREE_SCAN_PLATFORMS: AiPlatform[] = ["chatgpt", "perplexity"];
const CRAWL_TIMEOUT_MS = 8_000;
const QUERY_GEN_TIMEOUT_MS = 10_000;
const CITATION_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 45_000;

// ─── Engine wrappers ────────────────────────────────────────────────────────

async function crawlUrl(
  url: string,
  signal: AbortSignal
): Promise<CrawlResult> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Firecrawl returned ${response.status}`);
  }

  const json = await response.json();
  const content: string = json.data?.markdown ?? "";
  const metadata = json.data?.metadata ?? {};

  // Extract business info from crawled content
  return {
    businessName: metadata.title ?? extractBusinessName(content, url),
    category: null, // Inferred by Claude during query generation from actual page content
    city: null,
    state: null,
    phone: extractPhone(content),
    address: null,
    services: [],
    hours: null,
    description: metadata.description ?? metadata.ogDescription ?? null,
    about: null,
    keyPages: [],
    rawContent: content.slice(0, 10_000),
  };
}

function extractBusinessName(content: string, url: string): string {
  // Try first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Fallback to domain name
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return url;
  }
}

// inferCategory removed — category is now determined by Claude from actual page content
// during query generation, which handles all industries without a hardcoded keyword list

function extractPhone(content: string): string | null {
  const phoneMatch = content.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  );
  return phoneMatch ? phoneMatch[0] : null;
}

interface QueryGenResult {
  category: string;
  queries: string[];
}

async function generateQueries(
  businessName: string,
  city: string | null,
  description: string | null,
  rawContent: string | null,
  signal: AbortSignal
): Promise<QueryGenResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const locationStr = city ?? "their area";

  // Build context from the crawled page so Claude knows what the business actually does
  let businessContext = "";
  if (description) {
    businessContext += `\nBusiness description: "${description}"`;
  }
  if (rawContent) {
    businessContext += `\nPage content excerpt: "${rawContent.slice(0, 1500)}"`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are helping check a business's visibility in AI search results. Analyze the provided context to determine what this business does, then generate search queries.

Business name: "${businessName}"
Location: ${locationStr}${businessContext}

Return a JSON object with:
- "category": a short label for what this business is (e.g. "clothing store", "dental clinic", "plumbing contractor", "italian restaurant"). Infer this from the page content, not assumptions.
- "queries": 3-5 realistic queries a person would ask an AI assistant when looking for this type of business. Queries MUST match the actual business type. Include direct, problem-based, and specific product/service queries.

Return ONLY the JSON object, no explanation.`,
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Claude API returned ${response.status}`);
  }

  const json = await response.json();
  const text: string = json.content?.[0]?.text ?? "{}";

  // Try parsing as { category, queries } object first
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]) as { category?: string; queries?: string[] };
      if (parsed.queries && Array.isArray(parsed.queries)) {
        return {
          category: parsed.category ?? "local business",
          queries: parsed.queries.filter((q): q is string => typeof q === "string").slice(0, 5),
        };
      }
    } catch {
      // Fall through to array parsing
    }
  }

  // Fallback: try parsing as plain array (backwards compat)
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const queries = JSON.parse(arrayMatch[0]) as string[];
      return {
        category: "local business",
        queries: queries.slice(0, 5),
      };
    } catch {
      // Fall through to default
    }
  }

  return {
    category: "local business",
    queries: [`best ${businessName} in ${locationStr}`],
  };
}

async function checkCitationOnPlatform(
  query: string,
  businessName: string,
  platform: AiPlatform,
  signal: AbortSignal
): Promise<CitationResult> {
  if (platform === "chatgpt") {
    return checkChatGPT(query, businessName, signal);
  }
  if (platform === "perplexity") {
    return checkPerplexity(query, businessName, signal);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

async function checkChatGPT(
  query: string,
  businessName: string,
  signal: AbortSignal
): Promise<CitationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are answering a local business query. Provide specific business recommendations with names, brief descriptions, and ratings if known.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 1024,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const json = await response.json();
  const rawResponse: string = json.choices?.[0]?.message?.content ?? "";

  const match = isBusinessMentioned(rawResponse, businessName);
  const sources = extractSourcesFromText(rawResponse);

  return {
    cited: match.cited,
    position: match.position,
    sentiment: match.cited ? inferSentiment(rawResponse, businessName) : null,
    rawResponse,
    sourcesCited: sources,
  };
}

async function checkPerplexity(
  query: string,
  businessName: string,
  signal: AbortSignal
): Promise<CitationResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not configured");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are answering a local business query. Provide specific business recommendations with names, brief descriptions, and ratings if known.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 1024,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Perplexity API returned ${response.status}`);
  }

  const json = await response.json();
  const rawResponse: string = json.choices?.[0]?.message?.content ?? "";

  // Perplexity returns structured citations
  const perplexityCitations: string[] = json.citations ?? [];
  const sources: ExtractedSource[] = perplexityCitations.map((url: string) => ({
    domain: normalizeDomain(url),
    url,
  }));

  // Also extract any URLs from the text body
  const textSources = extractSourcesFromText(rawResponse);
  const allSources = deduplicateSources([...sources, ...textSources]);

  const match = isBusinessMentioned(rawResponse, businessName);

  return {
    cited: match.cited,
    position: match.position,
    sentiment: match.cited ? inferSentiment(rawResponse, businessName) : null,
    rawResponse,
    sourcesCited: allSources,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractSourcesFromText(text: string): ExtractedSource[] {
  const urlRegex = /https?:\/\/[^\s)>\]"']+/g;
  const matches = text.match(urlRegex) ?? [];

  return matches.map((url) => ({
    domain: normalizeDomain(url),
    url,
  }));
}

function deduplicateSources(sources: ExtractedSource[]): ExtractedSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.domain)) return false;
    seen.add(s.domain);
    return true;
  });
}

function inferSentiment(
  response: string,
  businessName: string
): "positive" | "neutral" | "negative" {
  const lower = response.toLowerCase();
  const nameLower = businessName.toLowerCase();
  const nameIndex = lower.indexOf(nameLower);
  if (nameIndex === -1) return "neutral";

  // Look at the surrounding context (200 chars around the mention)
  const start = Math.max(0, nameIndex - 100);
  const end = Math.min(lower.length, nameIndex + nameLower.length + 100);
  const context = lower.slice(start, end);

  const positiveSignals = [
    "highly recommended",
    "top-rated",
    "excellent",
    "great",
    "best",
    "popular",
    "well-known",
    "reputable",
    "trusted",
    "outstanding",
  ];
  const negativeSignals = [
    "complaints",
    "issues",
    "poor",
    "avoid",
    "negative",
    "bad reviews",
    "problematic",
  ];

  const hasPositive = positiveSignals.some((s) => context.includes(s));
  const hasNegative = negativeSignals.some((s) => context.includes(s));

  if (hasPositive && !hasNegative) return "positive";
  if (hasNegative && !hasPositive) return "negative";
  return "neutral";
}

function detectCompetitor(
  results: { platform: string; rawResponse: string }[],
  businessName: string
): { name: string; url: string | null } | null {
  const businessLower = businessName.toLowerCase();

  // Regex to find numbered list items with business-like names
  const businessPattern = /\d+\.\s\*\*([^*]+)\*\*/g;

  for (const result of results) {
    let match: RegExpExecArray | null;
    while ((match = businessPattern.exec(result.rawResponse)) !== null) {
      const name = match[1].trim();
      if (name.toLowerCase() !== businessLower && name.length > 2 && name.length < 100) {
        return { name, url: null };
      }
    }
  }

  // Fallback: look for any capitalized multi-word phrase that looks like a business
  for (const result of results) {
    const capitalizedPattern = /(?:^|\.\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
    let match: RegExpExecArray | null;
    while ((match = capitalizedPattern.exec(result.rawResponse)) !== null) {
      const name = match[1].trim();
      if (name.toLowerCase() !== businessLower && name.length > 4 && name.length < 80) {
        return { name, url: null };
      }
    }
  }

  return null;
}

function calculateScore(
  queryResults: { query: string; results: { platform: string; cited: boolean; position: number | null }[] }[],
  setupComplete: boolean
): ScoreBreakdown {
  const totalQueries = queryResults.length;
  if (totalQueries === 0) {
    return { queryCoverage: 0, platformCoverage: 0, positionQuality: 0, setupComplete: 0, total: 0 };
  }

  // Query coverage: fraction of queries where business was cited on at least one platform
  const citedQueries = queryResults.filter((q) =>
    q.results.some((r) => r.cited)
  ).length;
  const queryCoverage = citedQueries / totalQueries;

  // Platform coverage: fraction of platforms that cited the business at least once
  const platformSet = new Set(queryResults.flatMap((q) => q.results.map((r) => r.platform)));
  const platformsCiting = new Set(
    queryResults.flatMap((q) => q.results.filter((r) => r.cited).map((r) => r.platform))
  );
  const platformCoverage = platformSet.size > 0 ? platformsCiting.size / platformSet.size : 0;

  // Position quality: average position score across cited results
  const positionScores: number[] = [];
  for (const q of queryResults) {
    for (const r of q.results) {
      if (r.cited && r.position !== null) {
        // 1st = 1.0, 2nd = 0.7, 3rd = 0.5, 4th+ = 0.3
        const score = r.position === 1 ? 1.0 : r.position === 2 ? 0.7 : r.position === 3 ? 0.5 : 0.3;
        positionScores.push(score);
      }
    }
  }
  const positionQuality =
    positionScores.length > 0
      ? positionScores.reduce((a, b) => a + b, 0) / positionScores.length
      : 0;

  // Setup complete: always 0 for free scan
  const setupScore = setupComplete ? 1 : 0;

  const total = Math.round(
    queryCoverage * 40 +
    platformCoverage * 30 +
    positionQuality * 20 +
    setupScore * 10
  );

  return {
    queryCoverage: Math.round(queryCoverage * 100),
    platformCoverage: Math.round(platformCoverage * 100),
    positionQuality: Math.round(positionQuality * 100),
    setupComplete: setupScore * 100,
    total: Math.max(0, Math.min(100, total)),
  };
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function runFreeScan(url: string): Promise<ScanResult> {
  return withTimeout(async (signal) => {
    // Step 1: Crawl the URL
    const crawlResult = await withTimeout(
      (s) => crawlUrl(url, s),
      CRAWL_TIMEOUT_MS
    );

    const businessName = crawlResult.businessName;
    const city = crawlResult.city;

    // Step 2: Generate queries (Claude infers category from page content)
    const queryGenResult = await withTimeout(
      (s) => generateQueries(businessName, city, crawlResult.description, crawlResult.rawContent, s),
      QUERY_GEN_TIMEOUT_MS
    );
    const { category, queries } = queryGenResult;

    // Step 3: Citation checks — queries x platforms in parallel
    const citationTasks: {
      query: string;
      platform: AiPlatform;
      promise: Promise<CitationResult>;
    }[] = [];

    for (const query of queries) {
      for (const platform of FREE_SCAN_PLATFORMS) {
        citationTasks.push({
          query,
          platform,
          promise: withTimeout(
            (s) => checkCitationOnPlatform(query, businessName, platform, s),
            CITATION_TIMEOUT_MS
          ),
        });
      }
    }

    const settledResults = await Promise.allSettled(
      citationTasks.map((t) => t.promise)
    );

    // Step 4: Assemble per-query results and extract sources
    const allSources: ExtractedSource[] = [];
    const rawResponses: { platform: string; rawResponse: string }[] = [];

    const queryResults: ScanResult["queries"] = queries.map((query) => {
      const results: { platform: string; cited: boolean; position: number | null }[] = [];

      for (const platform of FREE_SCAN_PLATFORMS) {
        const taskIndex = citationTasks.findIndex(
          (t) => t.query === query && t.platform === platform
        );
        const settled = settledResults[taskIndex];

        if (settled && settled.status === "fulfilled") {
          const citation = settled.value;
          results.push({
            platform,
            cited: citation.cited,
            position: citation.position,
          });
          allSources.push(...citation.sourcesCited);
          rawResponses.push({ platform, rawResponse: citation.rawResponse });
        } else {
          // Platform failed — mark as not cited
          results.push({ platform, cited: false, position: null });
        }
      }

      return { query, results };
    });

    // Step 5: Platform summary
    const platformSummary = FREE_SCAN_PLATFORMS.map((platform) => {
      const platformResults = queryResults.flatMap((q) =>
        q.results.filter((r) => r.platform === platform)
      );
      return {
        platform,
        queriesChecked: platformResults.length,
        citedCount: platformResults.filter((r) => r.cited).length,
      };
    });

    // Step 6: Top sources
    const sourceCounts = new Map<string, number>();
    for (const source of allSources) {
      sourceCounts.set(source.domain, (sourceCounts.get(source.domain) ?? 0) + 1);
    }
    const topSources = Array.from(sourceCounts.entries())
      .map(([domain, citationCount]) => ({ domain, citationCount }))
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 10);

    // Step 7: Detect competitor
    const competitor = detectCompetitor(rawResponses, businessName);

    // Step 8: Calculate score (setupComplete = false for free scan)
    const breakdown = calculateScore(queryResults, false);

    return {
      score: breakdown.total,
      breakdown,
      platforms: platformSummary,
      queries: queryResults,
      topSources,
      competitor,
      businessInfo: {
        name: businessName,
        category,
        city,
      },
    };
  }, TOTAL_TIMEOUT_MS);
}
