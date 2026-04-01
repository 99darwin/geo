import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForPrompt } from "@/lib/utils/sanitize";

const QUERY_GEN_TIMEOUT_MS = 10_000;

type ServiceArea = "local" | "regional" | "national" | "global";

interface QueryGenParams {
  category: string;
  city?: string;
  services: string[];
  serviceArea?: ServiceArea;
  count?: number;
}

/**
 * Generate search queries using Claude API that a real person would ask
 * about this business type. Adapts query style based on geographic scope.
 */
export async function generateQueries(
  params: QueryGenParams,
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const { category, city, services, count, serviceArea } = params;
  const queryCount = count ?? 12;
  const scope = serviceArea ?? "local";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_GEN_TIMEOUT_MS);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const client = new Anthropic();

    const safeCategory = sanitizeForPrompt(category, 200);
    const safeCity = city ? sanitizeForPrompt(city, 100) : undefined;
    const safeServices = services.map((s) => sanitizeForPrompt(s, 100));

    const servicesContext =
      safeServices.length > 0
        ? `\nTheir specific services include: ${safeServices.join(", ")}.`
        : "";

    const prompt = buildPrompt({
      queryCount,
      category: safeCategory,
      city: safeCity,
      services: safeServices,
      servicesContext,
      scope,
    });

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

    const parsed = parseJsonArray(textBlock.text);
    if (!parsed || parsed.length === 0) {
      throw new Error("Failed to parse query array from Claude response");
    }

    return parsed.slice(0, queryCount);
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(args: {
  queryCount: number;
  category: string;
  city?: string;
  services: string[];
  servicesContext: string;
  scope: ServiceArea;
}): string {
  const { queryCount, category, city, services, servicesContext, scope } = args;
  const svc = services[0] || "service";

  switch (scope) {
    case "national":
      return buildNationalPrompt(queryCount, category, services, servicesContext);

    case "global":
      return buildGlobalPrompt(queryCount, category, services, servicesContext);

    case "regional":
      return buildRegionalPrompt(queryCount, category, city, services, servicesContext);

    case "local":
    default:
      return buildLocalPrompt(queryCount, category, city, svc, servicesContext);
  }
}

function buildLocalPrompt(
  queryCount: number,
  category: string,
  city: string | undefined,
  svc: string,
  servicesContext: string
): string {
  const location = city || "the area";
  return `Generate ${queryCount} queries that a real person would ask an AI assistant when looking for a ${category} in ${location}.${servicesContext} Include:
- Direct queries: 'best ${category} in ${location}'
- Problem queries: 'emergency ${svc} near me ${location}'
- Comparison queries: '${category} vs [competitor type] ${location}'
- Specific service queries: '${svc} ${location}'
Return as JSON array of strings. No numbering, no explanation.`;
}

function buildNationalPrompt(
  queryCount: number,
  category: string,
  services: string[],
  servicesContext: string
): string {
  const svc = services[0] || "products";
  return `Generate ${queryCount} queries that a real person would ask an AI assistant about a ${category}.${servicesContext}
This is a national brand/business, NOT a local storefront. Generate queries about:
- Brand discovery: 'best ${category} online', 'top ${category} brands'
- Product/service queries: 'best ${svc} from ${category}'
- Comparison queries: '${category} vs [competitor type]', '${category} reviews'
- Specific needs: '[specific use case] ${svc}'
Do NOT include city names or "near me" in queries.
Return as JSON array of strings. No numbering, no explanation.`;
}

function buildGlobalPrompt(
  queryCount: number,
  category: string,
  services: string[],
  servicesContext: string
): string {
  const svc = services[0] || "products";
  return `Generate ${queryCount} queries that a real person would ask an AI assistant about a ${category}.${servicesContext}
This is an international/global business. Generate queries about:
- Brand discovery: 'best ${category} online', 'top ${category} worldwide'
- Product/service queries: 'best ${svc} from ${category}'
- Comparison queries: '${category} vs [competitor type]', '${category} international reviews'
- Specific needs: '[specific use case] ${svc}'
- Include 2-3 queries with "international" or "worldwide" phrasing.
Do NOT include specific city names or "near me" in queries.
Return as JSON array of strings. No numbering, no explanation.`;
}

function buildRegionalPrompt(
  queryCount: number,
  category: string,
  city: string | undefined,
  services: string[],
  servicesContext: string
): string {
  const location = city || "the area";
  const svc = services[0] || "service";
  return `Generate ${queryCount} queries that a real person would ask an AI assistant about a ${category}.${servicesContext}
This business serves a regional area around ${location}. Generate a mix:
- Half the queries should reference the city/region: 'best ${category} in ${location}', '${svc} near ${location}'
- Half should be broader without location: 'top ${category}', '${category} reviews'
Include:
- Direct queries with and without location
- Problem/need queries
- Comparison queries
- Specific service queries: '${svc}'
Return as JSON array of strings. No numbering, no explanation.`;
}

function parseJsonArray(text: string): string[] | null {
  // Try direct parse
  try {
    const result = JSON.parse(text);
    if (Array.isArray(result)) return result.filter((s) => typeof s === "string");
  } catch {
    // Try extracting JSON from markdown code block
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      if (Array.isArray(result)) return result.filter((s) => typeof s === "string");
    } catch {
      // Failed to parse
    }
  }

  return null;
}
