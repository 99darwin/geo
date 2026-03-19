import type { CitationResult } from "./index";

export type AiPlatform = "chatgpt" | "perplexity" | "google_ai" | "gemini";

export type SentimentType = "positive" | "neutral" | "negative";

export type DirectoryPlatform =
  | "google"
  | "yelp"
  | "foursquare"
  | "bing"
  | "apple_maps"
  | "facebook";

export interface PlatformChecker {
  platform: AiPlatform;
  checkCitation(
    query: string,
    businessName: string,
    options?: { signal?: AbortSignal }
  ): Promise<CitationResult>;
}
