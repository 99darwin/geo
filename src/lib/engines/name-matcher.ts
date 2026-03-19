import type { NameMatchResult } from "@/types";

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Generate name variations for fuzzy matching.
 * Examples: "Bob's Dental Care" -> ["bob's dental care", "bobs dental care", "bob dental care", "bob's dental", "bob dental"]
 */
export function generateVariations(businessName: string): string[] {
  const variations = new Set<string>();
  const lower = businessName.toLowerCase().trim();

  // Original lowercase
  variations.add(lower);

  // Without possessives ('s, ')
  const withoutPossessive = lower.replace(/'s\b/g, "s");
  variations.add(withoutPossessive);

  const withoutPossessiveStripped = lower.replace(/'s\b/g, "");
  variations.add(withoutPossessiveStripped.trim());

  // Without articles
  const withoutArticles = lower.replace(/^(the|a|an)\s+/i, "");
  variations.add(withoutArticles);

  // Without articles AND without possessives
  const withoutBoth = withoutArticles.replace(/'s\b/g, "s");
  variations.add(withoutBoth);
  const withoutBothStripped = withoutArticles.replace(/'s\b/g, "");
  variations.add(withoutBothStripped.trim());

  // Common abbreviations
  const abbreviated = lower
    .replace(/\bstreet\b/g, "st")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdoctor\b/g, "dr")
    .replace(/\band\b/g, "&")
    .replace(/\bcompany\b/g, "co")
    .replace(/\bbrothers\b/g, "bros");
  if (abbreviated !== lower) variations.add(abbreviated);

  // Reverse abbreviations
  const expanded = lower
    .replace(/\bst\b/g, "street")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "doctor")
    .replace(/\b&\b/g, "and")
    .replace(/\bco\b/g, "company")
    .replace(/\bbros\b/g, "brothers");
  if (expanded !== lower) variations.add(expanded);

  // Partial match: first two words (for longer names)
  const words = lower.split(/\s+/);
  if (words.length > 2) {
    variations.add(words.slice(0, 2).join(" "));
    variations.add(words.slice(0, 2).join(" ").replace(/'s\b/g, "s"));
    variations.add(words.slice(0, 2).join(" ").replace(/'s\b/g, ""));
  }

  // Filter out empty strings
  variations.delete("");

  // Sort by length descending so longer (more specific) matches are tried first
  return Array.from(variations).sort((a, b) => b.length - a.length);
}

/**
 * Check if a business is mentioned in an AI response.
 * Uses substring matching with variations + Levenshtein distance < 3 as fallback.
 */
export function isBusinessMentioned(
  response: string,
  businessName: string
): NameMatchResult {
  const normalizedResponse = response.toLowerCase();
  const variations = generateVariations(businessName);

  // First pass: exact substring match on variations
  for (const variant of variations) {
    const index = normalizedResponse.indexOf(variant.toLowerCase());
    if (index !== -1) {
      const beforeText = normalizedResponse.slice(0, index);
      const position = (beforeText.match(/\d+\.\s/g) || []).length + 1;
      return { cited: true, position: Math.min(position, 10) };
    }
  }

  // Second pass: Levenshtein distance on words/phrases in response
  // Extract potential business name mentions (sequences of capitalized words in original response)
  const words = response.split(/\s+/);
  const primaryName = businessName.toLowerCase().trim();

  for (let i = 0; i < words.length; i++) {
    // Try matching phrases of similar word count to the business name
    const nameWordCount = primaryName.split(/\s+/).length;
    for (
      let len = Math.max(1, nameWordCount - 1);
      len <= nameWordCount + 1 && i + len <= words.length;
      len++
    ) {
      const phrase = words
        .slice(i, i + len)
        .join(" ")
        .toLowerCase()
        .replace(/[,.:;!?]/g, "");

      if (
        phrase.length >= 3 &&
        levenshteinDistance(phrase, primaryName) < 3
      ) {
        const beforeText = words.slice(0, i).join(" ").toLowerCase();
        const position = (beforeText.match(/\d+\.\s/g) || []).length + 1;
        return { cited: true, position: Math.min(position, 10) };
      }
    }
  }

  return { cited: false, position: null };
}
