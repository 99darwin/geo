import type { AiPlatform } from "@/types/platforms";
import type { ExtractedSource } from "@/types";

/**
 * Extract source URLs/domains from an AI platform's raw response.
 */
export function extractSources(
  rawResponse: string,
  platform: AiPlatform
): ExtractedSource[] {
  if (platform === "perplexity") {
    return extractPerplexitySources(rawResponse);
  }

  // ChatGPT, Gemini, google_ai: regex-based extraction
  return extractUrlSources(rawResponse);
}

/**
 * Perplexity returns structured citations — parse from JSON metadata.
 */
function extractPerplexitySources(rawResponse: string): ExtractedSource[] {
  const sources: ExtractedSource[] = [];

  // Try parsing as JSON (contains { text, citations })
  try {
    const parsed = JSON.parse(rawResponse);
    if (parsed.citations && Array.isArray(parsed.citations)) {
      for (const citation of parsed.citations) {
        const url = typeof citation === "string" ? citation : citation?.url;
        if (url) {
          const domain = normalizeDomain(url);
          if (domain) {
            sources.push({ domain, url });
          }
        }
      }
    }

    // Also extract URLs from the text portion
    if (parsed.text) {
      sources.push(...extractUrlSources(parsed.text));
    }
  } catch {
    // Not JSON — fall back to regex extraction
    sources.push(...extractUrlSources(rawResponse));
  }

  return deduplicateSources(sources);
}

/**
 * Extract URLs from response text using regex.
 * Handles both raw URLs and markdown links.
 */
function extractUrlSources(text: string): ExtractedSource[] {
  const sources: ExtractedSource[] = [];

  // Markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const url = match[2];
    const domain = normalizeDomain(url);
    if (domain) {
      sources.push({ domain, url });
    }
  }

  // Raw URLs (not already captured by markdown)
  const urlRegex = /(?<!\()(https?:\/\/[^\s,)}\]"']+)/g;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[1].replace(/[.;:]+$/, ""); // Strip trailing punctuation
    const domain = normalizeDomain(url);
    if (domain) {
      sources.push({ domain, url });
    }
  }

  return deduplicateSources(sources);
}

/**
 * Normalize a URL to its domain.
 * Strips www, trailing slashes, and common non-content domains.
 */
function normalizeDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./, "").toLowerCase();

    // Filter out non-useful domains
    const ignoredDomains = [
      "google.com",
      "googleapis.com",
      "openai.com",
      "perplexity.ai",
      "anthropic.com",
      "schema.org",
      "w3.org",
    ];

    if (ignoredDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return null;
    }

    return domain;
  } catch {
    return null;
  }
}

function deduplicateSources(sources: ExtractedSource[]): ExtractedSource[] {
  const seen = new Map<string, ExtractedSource>();

  for (const source of sources) {
    if (!seen.has(source.domain)) {
      seen.set(source.domain, source);
    } else if (source.url && !seen.get(source.domain)!.url) {
      // Prefer entries with a URL
      seen.set(source.domain, source);
    }
  }

  return Array.from(seen.values());
}
