import Anthropic from "@anthropic-ai/sdk";
import type { DetectedCompetitor } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";
import { sanitizeForPrompt } from "@/lib/utils/sanitize";

const CATEGORY_FILTER_TIMEOUT_MS = 10_000;

interface CitationResponse {
  query: string;
  platform: string;
  rawResponse: string;
  sourcesCited: { domain: string; url: string | null }[];
}

/**
 * Common non-business strings that regex patterns pick up from AI responses.
 * Includes structured data field names, HTTP errors, and generic phrases.
 */
const NON_BUSINESS_NAMES = new Set([
  "rating",
  "ratings",
  "description",
  "address",
  "phone",
  "hours",
  "website",
  "reviews",
  "review",
  "location",
  "directions",
  "menu",
  "price",
  "prices",
  "pricing",
  "category",
  "categories",
  "summary",
  "overview",
  "about",
  "contact",
  "features",
  "services",
  "products",
  "disclaimer",
  "too many requests",
  "not found",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "access denied",
  "forbidden",
  "unauthorized",
  "error",
  "unknown",
  "none",
  "null",
  "undefined",
  "based on",
  "according to",
  "note that",
  "keep in mind",
  "important note",
  "please note",
  "in conclusion",
  "top picks",
  "best options",
  "here are some",
  "google maps",
  "yelp reviews",
  "trip advisor",
]);

/**
 * Check if a string looks like a real business name vs noise.
 */
function isLikelyBusinessName(name: string): boolean {
  const lower = name.toLowerCase().trim();

  // Reject known non-business strings
  if (NON_BUSINESS_NAMES.has(lower)) return false;

  // Reject if it's a single common English word (< 2 words, and in blocklist)
  if (!/\s/.test(lower) && NON_BUSINESS_NAMES.has(lower)) return false;

  // Reject strings that are all numbers or all punctuation
  if (/^[\d\s.,]+$/.test(name)) return false;
  if (/^[\W\s]+$/.test(name)) return false;

  // Reject HTTP status-like patterns
  if (/^\d{3}\s/.test(name.trim())) return false;

  // Reject strings with URLs or email-like patterns
  if (/https?:|www\.|@/.test(name)) return false;

  return true;
}

/**
 * Extract potential business names from AI response text.
 * Looks for bold markdown, numbered/bulleted list items, and capitalized word sequences.
 * Filters out common noise like structured data fields and HTTP errors.
 */
function extractBusinessNames(text: string): string[] {
  // Skip responses that look like HTTP errors or empty content
  if (/^(\d{3}\s)?(Too Many Requests|Not Found|Internal Server Error|Bad Gateway|Service Unavailable)/i.test(text.trim())) {
    return [];
  }
  if (text.trim().length < 50) return [];

  const names = new Set<string>();

  // Pattern 1: Bold markdown — **Name** or __Name__
  const boldPattern = /\*\*([^*]+)\*\*|__([^_]+)__/g;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = (match[1] || match[2]).trim();
    if (name.length >= 3 && name.length <= 60 && isLikelyBusinessName(name)) {
      names.add(name);
    }
  }

  // Pattern 2: Numbered or bulleted list items — "1. Name" or "- Name"
  const listPattern = /(?:^\s*(?:\d+\.\s+|-\s+))([A-Z][A-Za-z''\s&.]+)/gm;
  while ((match = listPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Take only the first few words (business names are typically short)
    const words = name.split(/\s+/).slice(0, 5).join(" ");
    if (words.length >= 3 && words.length <= 60 && isLikelyBusinessName(words)) {
      names.add(words);
    }
  }

  // Pattern 3: Sequences of 2-4 capitalized words that look like business names
  const capPattern = /(?<![.!?]\s)(?:(?:[A-Z][a-z]+(?:'s)?)\s){1,3}(?:[A-Z][a-z]+(?:'s)?)/g;
  while ((match = capPattern.exec(text)) !== null) {
    const name = match[0].trim();
    // Filter out common sentence starters and generic phrases
    const genericPhrases = new Set([
      "the best",
      "the top",
      "the most",
      "this is",
      "here are",
      "you can",
      "i would",
      "for example",
      "such as",
      "in addition",
      "on the",
      "at the",
    ]);
    if (
      name.length >= 5 &&
      name.length <= 60 &&
      !genericPhrases.has(name.toLowerCase()) &&
      isLikelyBusinessName(name)
    ) {
      names.add(name);
    }
  }

  return Array.from(names);
}

/**
 * Simplify a name for matching against domains.
 * "Bob's Pizza Palace" -> "bobspizzapalace"
 */
function simplifyForDomainMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Try to find a domain for a competitor name from source citations.
 */
function findDomainForCompetitor(
  competitorName: string,
  allSources: { domain: string; url: string | null }[]
): string | undefined {
  const simplified = simplifyForDomainMatch(competitorName);
  if (simplified.length < 3) return undefined;

  for (const source of allSources) {
    const simplifiedDomain = simplifyForDomainMatch(source.domain);
    if (simplifiedDomain.includes(simplified) || simplified.includes(simplifiedDomain)) {
      return source.domain;
    }
  }

  return undefined;
}

/**
 * Detect competitors mentioned in AI citation responses.
 *
 * Extracts business names from raw AI responses, filters out the client's own
 * business, and returns the top 5 competitors by number of query appearances.
 * Only returns competitors mentioned in 2+ distinct responses (noise reduction).
 *
 * When a category is provided (and is not the generic "Local Business"),
 * uses Claude Haiku to filter out businesses from unrelated industries.
 */
export async function detectCompetitors(params: {
  businessName: string;
  category?: string;
  citationResponses: CitationResponse[];
}): Promise<DetectedCompetitor[]> {
  const { businessName, citationResponses } = params;

  // Track competitors: name (lowercased) -> aggregated data
  const competitorMap = new Map<
    string,
    {
      displayName: string;
      queries: Set<string>;
      platforms: Set<string>;
      sources: { domain: string; url: string | null }[];
    }
  >();

  for (const response of citationResponses) {
    const extractedNames = extractBusinessNames(response.rawResponse);

    for (const name of extractedNames) {
      // Filter out the client's own business
      const selfMatch = isBusinessMentioned(name, businessName);
      if (selfMatch.cited) continue;

      const key = name.toLowerCase().trim();
      if (!key) continue;

      const existing = competitorMap.get(key);
      if (existing) {
        existing.queries.add(response.query);
        existing.platforms.add(response.platform);
        existing.sources.push(...response.sourcesCited);
      } else {
        competitorMap.set(key, {
          displayName: name,
          queries: new Set([response.query]),
          platforms: new Set([response.platform]),
          sources: [...response.sourcesCited],
        });
      }
    }
  }

  // Filter: only competitors mentioned in 2+ distinct responses
  const allSources = citationResponses.flatMap((r) => r.sourcesCited);
  const competitors: DetectedCompetitor[] = [];

  for (const [, data] of competitorMap) {
    // Must appear in at least 2 distinct responses (approximated by query count)
    if (data.queries.size < 2) continue;

    const domain = findDomainForCompetitor(data.displayName, allSources);

    competitors.push({
      name: data.displayName,
      domain,
      citedInQueries: Array.from(data.queries),
      platforms: Array.from(data.platforms),
    });
  }

  // Sort by number of query appearances (descending), take top 5
  competitors.sort((a, b) => b.citedInQueries.length - a.citedInQueries.length);
  const top = competitors.slice(0, 5);

  // If we have a category, filter by industry relevance
  if (params.category && params.category !== "Local Business" && top.length > 0) {
    const filtered = await filterCompetitorsByCategory(top, params.category);
    return filtered.slice(0, 5);
  }

  return top;
}

/**
 * Use Claude Haiku to filter competitor candidates by industry relevance.
 * Only keeps businesses that are actual competitors in the same or closely
 * related industry as the given category.
 *
 * On any failure (API error, parse error, timeout), returns the original
 * candidates unchanged (graceful degradation).
 */
async function filterCompetitorsByCategory(
  candidates: DetectedCompetitor[],
  category: string
): Promise<DetectedCompetitor[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CATEGORY_FILTER_TIMEOUT_MS);

    try {
      const client = new Anthropic();
      const nameList = candidates.map((c) => sanitizeForPrompt(c.name, 100)).join("\n");
      const safeCategory = sanitizeForPrompt(category, 200);

      const response = await client.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: `A business in the category '${safeCategory}' has the following potential competitors detected from AI search results. Return ONLY the names that are actual competitors in the same or a closely related industry. For example, if the business is a clothing store, only return other clothing/fashion/apparel businesses — not restaurants, medical practices, etc.\n\nPotential competitors:\n${nameList}\n\nReturn as a JSON array of strings containing only the qualifying competitor names.`,
            },
          ],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") return candidates;

      // Extract JSON array from the response (may be wrapped in markdown code fences)
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return candidates;

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return candidates;

      const approvedNames = new Set(
        parsed
          .filter((item): item is string => typeof item === "string")
          .map((name) => name.toLowerCase().trim())
      );

      const filtered = candidates.filter((c) =>
        approvedNames.has(c.name.toLowerCase().trim())
      );

      // If filtering removed everything, return originals (likely a false negative)
      return filtered.length > 0 ? filtered : candidates;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Graceful degradation: return unfiltered candidates on any failure
    return candidates;
  }
}
