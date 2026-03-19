import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PlatformChecker } from "@/types/platforms";
import type { AiPlatform } from "@/types/platforms";
import type { CitationResult } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";
import { extractSources } from "@/lib/engines/source-extractor";

const GEMINI_TIMEOUT_MS = 10_000;

export class GeminiChecker implements PlatformChecker {
  platform: AiPlatform = "gemini";

  async checkCitation(
    query: string,
    businessName: string,
    options?: { signal?: AbortSignal }
  ): Promise<CitationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not set");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const systemPrompt =
        "You are answering a local business query. Provide specific business recommendations with names, brief descriptions, and ratings if known.";

      const result = await Promise.race([
        model.generateContent({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${query}` }] },
          ],
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Gemini request timed out"))
          );
        }),
      ]);

      const rawResponse = result.response.text();
      const match = isBusinessMentioned(rawResponse, businessName);
      const sourcesCited = extractSources(rawResponse, "gemini");

      return {
        cited: match.cited,
        position: match.position,
        sentiment: match.cited ? "neutral" : null,
        rawResponse,
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
