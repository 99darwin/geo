import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForPrompt } from "@/lib/utils/sanitize";

const ENRICHER_TIMEOUT_MS = 10_000;

interface EnrichInput {
  rawContent: string;
  url: string;
}

interface EnrichedBusinessInfo {
  businessName: string;
  category: string;
  city: string | null;
  state: string | null;
  services: string[];
  about: string;
  serviceArea: "local" | "regional" | "national" | "global";
}

/**
 * Infer structured business data from raw crawl content using Claude.
 * Useful when the crawler fails to extract category, city, services, or about
 * text — especially for sites without JSON-LD structured data.
 *
 * Engine pattern: no DB access. Takes input, returns output.
 */
export async function enrichBusinessInfo(
  input: EnrichInput,
  options?: { signal?: AbortSignal }
): Promise<EnrichedBusinessInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICHER_TIMEOUT_MS);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const client = new Anthropic();

    const safeContent = sanitizeForPrompt(input.rawContent, 2000);
    const safeUrl = sanitizeForPrompt(input.url, 300);

    const prompt = `Analyze the following webpage content and infer structured business information. Return ONLY a JSON object with these fields:

- "businessName": The proper business name (not the URL or domain).
- "category": A short descriptor like "dental clinic", "clothing and apparel retailer", "Italian restaurant". Lowercase.
- "city": The city the business is located in, or null if not detectable.
- "state": The US state (full name) the business is in, or null if not detectable.
- "services": An array of up to 10 specific services or products the business offers. Short phrases.
- "about": A 2-3 sentence summary of what this business does and what makes it notable.
- "serviceArea": One of "local" (physical storefront serving a city/neighborhood), "regional" (multiple locations in a metro or state), "national" (ships nationwide or serves customers across the country, e-commerce), or "global" (international presence).

<page_url>${safeUrl}</page_url>
<page_content>${safeContent}</page_content>

Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const parsed = parseEnrichedJson(textBlock.text);
    if (!parsed) {
      throw new Error("Failed to parse business info from Claude response");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

const VALID_SERVICE_AREAS = new Set(["local", "regional", "national", "global"]);

function parseEnrichedJson(text: string): EnrichedBusinessInfo | null {
  const candidates = [text, extractJsonObject(text)].filter(Boolean) as string[];

  for (const raw of candidates) {
    try {
      const result = JSON.parse(raw);
      if (typeof result !== "object" || result === null) continue;

      const businessName = typeof result.businessName === "string" ? result.businessName.trim() : "";
      const category = typeof result.category === "string" ? result.category.trim() : "";
      const about = typeof result.about === "string" ? result.about.trim() : "";

      if (!businessName || !category || !about) continue;

      const city = typeof result.city === "string" ? result.city.trim() : null;
      const state = typeof result.state === "string" ? result.state.trim() : null;

      const services = Array.isArray(result.services)
        ? result.services.filter((s: unknown) => typeof s === "string").slice(0, 10)
        : [];

      const serviceArea = VALID_SERVICE_AREAS.has(result.serviceArea)
        ? (result.serviceArea as EnrichedBusinessInfo["serviceArea"])
        : "local";

      return { businessName, category, city, state, services, about, serviceArea };
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}
