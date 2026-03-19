import OpenAI from "openai";
import type { PlatformChecker } from "@/types/platforms";
import type { AiPlatform } from "@/types/platforms";
import type { CitationResult } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";
import { extractSources } from "@/lib/engines/source-extractor";

const CHATGPT_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT =
  "You are answering a local business query. Provide specific business recommendations with names, brief descriptions, and ratings if known.";

export class ChatGPTChecker implements PlatformChecker {
  platform: AiPlatform = "chatgpt";

  async checkCitation(
    query: string,
    businessName: string,
    options?: { signal?: AbortSignal }
  ): Promise<CitationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHATGPT_TIMEOUT_MS);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const client = new OpenAI();

      const response = await client.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        },
        { signal: controller.signal }
      );

      const rawResponse = response.choices[0]?.message?.content || "";
      const match = isBusinessMentioned(rawResponse, businessName);
      const sourcesCited = extractSources(rawResponse, "chatgpt");

      return {
        cited: match.cited,
        position: match.position,
        sentiment: match.cited ? detectSentiment(rawResponse, businessName) : null,
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

function detectSentiment(
  response: string,
  businessName: string
): "positive" | "neutral" | "negative" {
  const lower = response.toLowerCase();
  const nameIndex = lower.indexOf(businessName.toLowerCase());
  if (nameIndex === -1) return "neutral";

  // Check surrounding context (200 chars around mention)
  const start = Math.max(0, nameIndex - 100);
  const end = Math.min(lower.length, nameIndex + businessName.length + 100);
  const context = lower.slice(start, end);

  const positiveWords = [
    "recommend",
    "excellent",
    "great",
    "top",
    "best",
    "highly rated",
    "popular",
    "well-known",
    "trusted",
    "quality",
    "outstanding",
  ];
  const negativeWords = [
    "avoid",
    "poor",
    "bad",
    "worst",
    "complaints",
    "issues",
    "problems",
    "negative",
    "low rated",
  ];

  const hasPositive = positiveWords.some((w) => context.includes(w));
  const hasNegative = negativeWords.some((w) => context.includes(w));

  if (hasPositive && !hasNegative) return "positive";
  if (hasNegative && !hasPositive) return "negative";
  return "neutral";
}
