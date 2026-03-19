import type {
  NapCheckResult,
  Recommendation,
  ReviewPullResult,
} from "@/types";

interface RecommendationParams {
  robotsAudit: { accessible: boolean; blocked: string[]; status: string };
  hasLlmsTxt: boolean;
  hasSchema: boolean;
  citedQueryCount: number;
  totalQueryCount: number;
  platformsCiting: string[];
  totalPlatforms: number;
  napResults?: NapCheckResult[];
  reviewSnapshots?: ReviewPullResult[];
}

/**
 * Generate actionable recommendations based on scan/check results.
 * Pure function — no API calls or DB access.
 *
 * Returns recommendations ordered by severity: critical > important > suggestion.
 * Each has a unique `id` for React key usage.
 */
export function generateRecommendations(
  params: RecommendationParams
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // --- CRITICAL ---

  if (params.robotsAudit.blocked.length > 0) {
    const blockedList = params.robotsAudit.blocked.join(", ");
    recommendations.push({
      id: "robots-blocking",
      severity: "critical",
      title: "robots.txt is blocking AI crawlers",
      description: `Your robots.txt file is blocking the following AI bots: ${blockedList}. These crawlers need access to index your site for AI search results. Update your robots.txt to remove Disallow rules for these user agents, or add explicit Allow directives.`,
    });
  }

  if (!params.hasLlmsTxt) {
    recommendations.push({
      id: "missing-llms-txt",
      severity: "critical",
      title: "Missing llms.txt file",
      description:
        "Your site does not have an llms.txt file. This file provides AI search engines with a structured summary of your business, making it easier for them to understand and cite your services. Adding an llms.txt file is one of the most effective ways to improve AI visibility.",
    });
  }

  if (!params.hasSchema) {
    recommendations.push({
      id: "missing-schema",
      severity: "critical",
      title: "Missing JSON-LD structured data",
      description:
        "Your site does not have JSON-LD structured data (schema markup). This machine-readable format helps AI engines understand your business details such as name, address, hours, and services. Adding LocalBusiness or Organization schema significantly improves your chances of being cited.",
    });
  }

  // --- IMPORTANT ---

  const citationRate =
    params.totalQueryCount > 0
      ? params.citedQueryCount / params.totalQueryCount
      : 0;

  if (citationRate < 0.25) {
    const pct = Math.round(citationRate * 100);
    recommendations.push({
      id: "low-citation-rate",
      severity: "important",
      title: "Low citation rate across AI platforms",
      description: `Your business is being cited in only ${pct}% of relevant queries (${params.citedQueryCount} of ${params.totalQueryCount}). Consider expanding your website content to cover more of the services and topics your potential customers are searching for.`,
    });
  }

  const platformCoverage =
    params.totalPlatforms > 0
      ? params.platformsCiting.length / params.totalPlatforms
      : 0;

  if (platformCoverage < 0.5) {
    const citingList =
      params.platformsCiting.length > 0
        ? params.platformsCiting.join(", ")
        : "none";
    recommendations.push({
      id: "low-platform-coverage",
      severity: "important",
      title: "Low AI platform coverage",
      description: `Your business is only being cited on ${params.platformsCiting.length} of ${params.totalPlatforms} AI platforms (${citingList}). Expanding your online presence and structured data can help you appear across more AI search engines.`,
    });
  }

  if (params.napResults) {
    for (const nap of params.napResults) {
      const mismatches: string[] = [];
      if (nap.nameMatch === false) mismatches.push("name");
      if (nap.addressMatch === false) mismatches.push("address");
      if (nap.phoneMatch === false) mismatches.push("phone");

      if (mismatches.length > 0) {
        recommendations.push({
          id: `nap-inconsistency-${nap.platform}`,
          severity: "important",
          title: `NAP inconsistency on ${nap.platform}`,
          description: `Your ${mismatches.join(" and ")} ${mismatches.length === 1 ? "does" : "do"} not match on ${nap.platform}. Inconsistent business information across directories hurts your credibility with AI search engines. Update your listing to ensure your name, address, and phone number are consistent everywhere.`,
          actionUrl: nap.listingUrl,
        });
      }
    }
  }

  if (params.reviewSnapshots) {
    for (const review of params.reviewSnapshots) {
      if (review.rating !== null && review.rating < 4.0) {
        recommendations.push({
          id: `low-rating-${review.platform}`,
          severity: "important",
          title: `Low rating on ${review.platform}`,
          description: `Your rating on ${review.platform} is ${review.rating.toFixed(1)}, which is below the 4.0 threshold that AI engines tend to favor. Focus on improving customer experience and encouraging satisfied customers to leave reviews.`,
          actionUrl: review.url,
        });
      }
    }
  }

  // --- SUGGESTIONS ---

  if (
    params.platformsCiting.length > 0 &&
    params.platformsCiting.length < params.totalPlatforms
  ) {
    // Only add if we didn't already flag low-platform-coverage as important
    if (platformCoverage >= 0.5) {
      const missingCount =
        params.totalPlatforms - params.platformsCiting.length;
      recommendations.push({
        id: "not-all-platforms",
        severity: "suggestion",
        title: "Not cited on all AI platforms",
        description: `You are being cited on ${params.platformsCiting.length} of ${params.totalPlatforms} platforms. There ${missingCount === 1 ? "is" : "are"} still ${missingCount} platform${missingCount === 1 ? "" : "s"} where your business does not appear. Broadening your content and structured data can help close this gap.`,
      });
    }
  }

  if (params.reviewSnapshots) {
    for (const review of params.reviewSnapshots) {
      if (
        review.reviewCount !== null &&
        review.reviewCount < 10 &&
        // Don't double-flag if already flagged for low rating
        (review.rating === null || review.rating >= 4.0)
      ) {
        recommendations.push({
          id: `low-review-count-${review.platform}`,
          severity: "suggestion",
          title: `Low review count on ${review.platform}`,
          description: `You have only ${review.reviewCount} review${review.reviewCount === 1 ? "" : "s"} on ${review.platform}. A higher number of reviews signals credibility to both customers and AI engines. Consider asking satisfied customers to share their experience.`,
          actionUrl: review.url,
        });
      }
    }
  }

  return recommendations;
}
