import type { AiPlatform } from "@/types/platforms";
import type { CitationResult } from "@/types";
import { getCheckersByPlatform } from "@/lib/engines/platforms";

const DEFAULT_RUNS_PER_QUERY = 3;

/**
 * Check citations across multiple queries and platforms.
 * Runs each (query, platform) pair multiple times and takes majority for `cited`.
 * Uses Promise.allSettled so one platform failure never blocks others.
 */
export async function checkCitations(
  params: {
    queries: string[];
    businessName: string;
    platforms: AiPlatform[];
    runsPerQuery?: number;
  },
  options?: { signal?: AbortSignal }
): Promise<Map<string, Map<AiPlatform, CitationResult>>> {
  const { queries, businessName, platforms, runsPerQuery = DEFAULT_RUNS_PER_QUERY } = params;
  const checkers = getCheckersByPlatform(platforms);

  const results = new Map<string, Map<AiPlatform, CitationResult>>();

  // Build all tasks: (query, checker) pairs
  const tasks: {
    query: string;
    platform: AiPlatform;
    promise: () => Promise<CitationResult>;
  }[] = [];

  for (const query of queries) {
    for (const checker of checkers) {
      tasks.push({
        query,
        platform: checker.platform,
        promise: async () => {
          // Run multiple times and take majority
          const runs: CitationResult[] = [];

          for (let i = 0; i < runsPerQuery; i++) {
            const result = await checker.checkCitation(query, businessName, options);
            runs.push(result);
          }

          return takeMajority(runs);
        },
      });
    }
  }

  // Execute all tasks in parallel
  const settled = await Promise.allSettled(tasks.map((t) => t.promise()));

  // Collect results
  for (let i = 0; i < tasks.length; i++) {
    const { query, platform } = tasks[i];
    const outcome = settled[i];

    if (!results.has(query)) {
      results.set(query, new Map());
    }

    const platformMap = results.get(query)!;

    if (outcome.status === "fulfilled") {
      platformMap.set(platform, outcome.value);
    } else {
      // Store error result
      platformMap.set(platform, {
        cited: false,
        position: null,
        sentiment: null,
        rawResponse: `Error: ${outcome.reason}`,
        sourcesCited: [],
      });
    }
  }

  return results;
}

/**
 * Take majority result from multiple runs.
 * If majority say cited=true, return a cited result with the best position found.
 */
function takeMajority(runs: CitationResult[]): CitationResult {
  const citedCount = runs.filter((r) => r.cited).length;
  const isCited = citedCount > runs.length / 2;

  if (isCited) {
    // Find the run with the best (lowest) position
    const citedRuns = runs.filter((r) => r.cited);
    const bestRun = citedRuns.reduce((best, current) => {
      if (best.position === null) return current;
      if (current.position === null) return best;
      return current.position < best.position ? current : best;
    }, citedRuns[0]);

    return {
      cited: true,
      position: bestRun.position,
      sentiment: bestRun.sentiment,
      rawResponse: bestRun.rawResponse,
      sourcesCited: deduplicateSources(
        citedRuns.flatMap((r) => r.sourcesCited)
      ),
    };
  }

  // Not cited — return the first run's data
  return {
    cited: false,
    position: null,
    sentiment: null,
    rawResponse: runs[0]?.rawResponse || "",
    sourcesCited: deduplicateSources(runs.flatMap((r) => r.sourcesCited)),
  };
}

function deduplicateSources(
  sources: { domain: string; url: string | null }[]
): { domain: string; url: string | null }[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.domain + (s.url || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
