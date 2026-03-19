import type { ScoreBreakdown } from "@/types";

const POSITION_SCORES: Record<number, number> = {
  1: 1.0,
  2: 0.7,
  3: 0.5,
};
const DEFAULT_POSITION_SCORE = 0.3; // 4th+

/**
 * Calculate the GEO visibility score.
 *
 * Formula: queryCoverage * 40 + platformCoverage * 30 + positionQuality * 20 + setupComplete * 10
 * Clamped to 0-100.
 */
export function calculateVisibilityScore(params: {
  citedQueries: number;
  totalQueries: number;
  platformsCiting: number;
  totalPlatforms: number;
  citations: { position: number | null }[];
  hasLlmsTxt: boolean;
  hasSchema: boolean;
  hasCleanRobotsTxt: boolean;
}): ScoreBreakdown {
  const {
    citedQueries,
    totalQueries,
    platformsCiting,
    totalPlatforms,
    citations,
    hasLlmsTxt,
    hasSchema,
    hasCleanRobotsTxt,
  } = params;

  // Query coverage: what fraction of queries got at least one citation
  const queryCoverage = totalQueries > 0 ? citedQueries / totalQueries : 0;

  // Platform coverage: what fraction of platforms cited the business
  const platformCoverage =
    totalPlatforms > 0 ? platformsCiting / totalPlatforms : 0;

  // Position quality: average position score across all cited results
  const positionQuality = calculatePositionQuality(citations);

  // Setup completeness: how many of the 3 setup items are done
  const setupItems = [hasLlmsTxt, hasSchema, hasCleanRobotsTxt];
  const setupComplete =
    setupItems.filter(Boolean).length / setupItems.length;

  const queryCoverageScore = queryCoverage * 40;
  const platformCoverageScore = platformCoverage * 30;
  const positionQualityScore = positionQuality * 20;
  const setupCompleteScore = setupComplete * 10;

  const total = Math.round(
    queryCoverageScore +
      platformCoverageScore +
      positionQualityScore +
      setupCompleteScore
  );

  return {
    queryCoverage: Math.round(queryCoverageScore),
    platformCoverage: Math.round(platformCoverageScore),
    positionQuality: Math.round(positionQualityScore),
    setupComplete: Math.round(setupCompleteScore),
    total: Math.max(0, Math.min(100, total)),
  };
}

function calculatePositionQuality(
  citations: { position: number | null }[]
): number {
  const citedWithPosition = citations.filter(
    (c) => c.position !== null
  ) as { position: number }[];

  if (citedWithPosition.length === 0) return 0;

  const totalScore = citedWithPosition.reduce((sum, c) => {
    return sum + (POSITION_SCORES[c.position] ?? DEFAULT_POSITION_SCORE);
  }, 0);

  return totalScore / citedWithPosition.length;
}
