import type { DetectedCompetitor } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";

interface CitationResponse {
  query: string;
  platform: string;
  rawResponse: string;
  sourcesCited: { domain: string; url: string | null }[];
}

/**
 * Extract potential business names from AI response text.
 * Looks for bold markdown, numbered/bulleted list items, and capitalized word sequences.
 */
function extractBusinessNames(text: string): string[] {
  const names = new Set<string>();

  // Pattern 1: Bold markdown — **Name** or __Name__
  const boldPattern = /\*\*([^*]+)\*\*|__([^_]+)__/g;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = (match[1] || match[2]).trim();
    if (name.length >= 3 && name.length <= 60) {
      names.add(name);
    }
  }

  // Pattern 2: Numbered or bulleted list items — "1. Name" or "- Name"
  const listPattern = /(?:^\s*(?:\d+\.\s+|-\s+))([A-Z][A-Za-z''\s&.]+)/gm;
  while ((match = listPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Take only the first few words (business names are typically short)
    const words = name.split(/\s+/).slice(0, 5).join(" ");
    if (words.length >= 3 && words.length <= 60) {
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
      !genericPhrases.has(name.toLowerCase())
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
 * Pure text processing — no API calls.
 *
 * Extracts business names from raw AI responses, filters out the client's own
 * business, and returns the top 5 competitors by number of query appearances.
 * Only returns competitors mentioned in 2+ distinct responses (noise reduction).
 */
export function detectCompetitors(params: {
  businessName: string;
  citationResponses: CitationResponse[];
}): DetectedCompetitor[] {
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

  // Sort by number of query appearances (descending), return top 5
  competitors.sort((a, b) => b.citedInQueries.length - a.citedInQueries.length);
  return competitors.slice(0, 5);
}
