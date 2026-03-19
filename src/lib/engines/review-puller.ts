import type { ReviewPullResult } from "@/types";

const DIRECTORY_TIMEOUT_MS = 5_000;

interface ReviewPullParams {
  businessName: string;
  city: string;
  state?: string;
}

/**
 * Pull review data from Google Maps via SerpAPI.
 */
async function pullGoogle(
  params: ReviewPullParams,
  signal: AbortSignal
): Promise<ReviewPullResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("review-puller: SERPAPI_KEY not set, skipping Google");
    throw new Error("SERPAPI_KEY_MISSING");
  }

  const query = encodeURIComponent(`${params.businessName} ${params.city}`);
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${query}&api_key=${apiKey}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status}`);
  }

  const data = await response.json();
  const result = data.local_results?.[0];

  if (!result) {
    return {
      platform: "google",
      rating: null,
      reviewCount: null,
    };
  }

  return {
    platform: "google",
    rating: result.rating ?? null,
    reviewCount: result.reviews ?? null,
    url: result.link || result.place_id_search || undefined,
  };
}

/**
 * Pull review data from Yelp Fusion API.
 */
async function pullYelp(
  params: ReviewPullParams,
  signal: AbortSignal
): Promise<ReviewPullResult> {
  const apiKey = process.env.YELP_FUSION_KEY;
  if (!apiKey) {
    console.warn("review-puller: YELP_FUSION_KEY not set, skipping Yelp");
    throw new Error("YELP_FUSION_KEY_MISSING");
  }

  const term = encodeURIComponent(params.businessName);
  const location = encodeURIComponent(
    params.city + (params.state ? `, ${params.state}` : "")
  );
  const url = `https://api.yelp.com/v3/businesses/search?term=${term}&location=${location}`;

  const response = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Yelp API returned ${response.status}`);
  }

  const data = await response.json();
  const biz = data.businesses?.[0];

  if (!biz) {
    return {
      platform: "yelp",
      rating: null,
      reviewCount: null,
    };
  }

  return {
    platform: "yelp",
    rating: biz.rating ?? null,
    reviewCount: biz.review_count ?? null,
    url: biz.url || undefined,
  };
}

/**
 * Pull review ratings and counts from directories.
 * MVP: Google Maps (SerpAPI) + Yelp (Fusion API).
 * Gracefully skips platforms when API keys are missing.
 */
export async function pullReviews(
  params: ReviewPullParams
): Promise<ReviewPullResult[]> {
  type PullFn = (
    params: ReviewPullParams,
    signal: AbortSignal
  ) => Promise<ReviewPullResult>;

  const pullers: PullFn[] = [pullGoogle, pullYelp];

  const settled = await Promise.allSettled(
    pullers.map((puller) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DIRECTORY_TIMEOUT_MS);

      return puller(params, controller.signal).finally(() =>
        clearTimeout(timeout)
      );
    })
  );

  const results: ReviewPullResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    }
    // Rejected means either missing API key or network error — skip silently
  }

  return results;
}
