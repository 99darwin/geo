import type { PlatformChecker } from "@/types/platforms";
import type { AiPlatform } from "@/types/platforms";
import { ChatGPTChecker } from "./chatgpt";
import { PerplexityChecker } from "./perplexity";
import { GeminiChecker } from "./gemini";

export const FREE_SCAN_PLATFORMS: AiPlatform[] = ["chatgpt", "perplexity"];

const CHECKER_MAP: Record<AiPlatform, () => PlatformChecker> = {
  chatgpt: () => new ChatGPTChecker(),
  perplexity: () => new PerplexityChecker(),
  gemini: () => new GeminiChecker(),
  google_ai: () => new GeminiChecker(), // google_ai maps to Gemini for now
};

/**
 * Get checker instances for all supported platforms.
 */
export function getAllCheckers(): PlatformChecker[] {
  return [
    new ChatGPTChecker(),
    new PerplexityChecker(),
    new GeminiChecker(),
  ];
}

/**
 * Get checker instances for specific platforms.
 */
export function getCheckersByPlatform(
  platforms: AiPlatform[]
): PlatformChecker[] {
  return platforms
    .filter((p) => p in CHECKER_MAP)
    .map((p) => CHECKER_MAP[p]());
}
