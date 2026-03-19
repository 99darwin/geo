import Anthropic from "@anthropic-ai/sdk";

const QUERY_GEN_TIMEOUT_MS = 10_000;

/**
 * Generate search queries using Claude API that a real person would ask
 * about this business type in this city.
 */
export async function generateQueries(
  params: {
    category: string;
    city: string;
    services: string[];
    count?: number;
  },
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const { category, city, services, count } = params;
  const queryCount = count ?? 12; // Default 10-15, use 12 as middle ground

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_GEN_TIMEOUT_MS);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const client = new Anthropic();

    const servicesContext =
      services.length > 0
        ? `\nTheir specific services include: ${services.join(", ")}.`
        : "";

    const prompt = `Generate ${queryCount} queries that a real person would ask an AI assistant when looking for a ${category} in ${city}.${servicesContext} Include:
- Direct queries: 'best ${category} in ${city}'
- Problem queries: 'emergency ${services[0] || "service"} near me ${city}'
- Comparison queries: '${category} vs [competitor type] ${city}'
- Specific service queries: '${services[0] || "service"} ${city}'
Return as JSON array of strings. No numbering, no explanation.`;

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
