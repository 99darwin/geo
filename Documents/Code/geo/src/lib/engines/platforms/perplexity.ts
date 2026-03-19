import OpenAI from "openai";
import type { PlatformChecker } from "@/types/platforms";
import type { AiPlatform } from "@/types/platforms";
import type { CitationResult } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";
import { extractSources } from "@/lib/engines/source-extractor";

const PERPLEXITY_TIMEOUT_MS = 10_000;

export class PerplexityChecker implements PlatformChecker {
  platform: AiPlatform = "perplexity";

  async checkCitation(
    query: string,
    businessName: string,
    options?: { signal?: AbortSignal }
  ): Promise<CitationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PERPLEXITY_TIMEOUT_MS);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const client = new OpenAI({
        apiKey: process.env.PERPLEXITY_API_KEY,
        baseURL: "https://api.perplexity.ai",
      });

      const response = await client.chat.completions.create(
        {
          model: "sonar",
          messages: [
            {
              role: "system",
              content:
                "You are answering a local business query. Provide specific business recommendations with names, brief descriptions, and ratings if known.",
            },
            { role: "user", content: query },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        },
        { signal: controller.signal }
      );

      const rawResponse = response.choices[0]?.message?.content || "";

      // Perplexity returns citations in response metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = (response as any).citations as string[] | undefined;

      // Build a combined raw response that includes citation metadata for source extraction
      const rawWithMeta = citations
        ? JSON.stringify({ text: rawResponse, citations })
        : rawResponse;

      const match = isBusinessMentioned(rawResponse, businessName);
      const sourcesCited = extractSources(rawWithMeta, "perplexity");

      return {
        cited: match.cited,
        position: match.position,
        sentiment: match.cited ? "neutral" : null,
        rawResponse: rawWithMeta,
        sourcesCited,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        cited: false,
        position: null,
        sentiment: null,
        rawResponse: `Error: ${message}`,
        sourcesCited: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
