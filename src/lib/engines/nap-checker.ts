import type { NapCheckResult } from "@/types";
import { isBusinessMentioned } from "@/lib/engines/name-matcher";

const DIRECTORY_TIMEOUT_MS = 5_000;

interface NapCheckParams {
  businessName: string;
  address?: string;
  phone?: string;
  city: string;
  state?: string;
}

/**
 * Normalize a phone number by stripping all non-digit characters.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Case-insensitive substring check for address matching.
 */
function addressMatches(
  listingAddress: string | undefined | null,
  targetAddress: string | undefined
): boolean | null {
  if (!targetAddress || !listingAddress) return null;
  return listingAddress.toLowerCase().includes(targetAddress.toLowerCase());
}

/**
 * Compare phone numbers after digit-only normalization.
 */
function phoneMatches(
  listingPhone: string | undefined | null,
  targetPhone: string | undefined
): boolean | null {
  if (!targetPhone || !listingPhone) return null;
  const normalizedListing = normalizePhone(listingPhone);
  const normalizedTarget = normalizePhone(targetPhone);
  if (!normalizedListing || !normalizedTarget) return null;
  return normalizedListing === normalizedTarget;
}

/**
 * Check Google Maps via SerpAPI for NAP consistency.
 */
async function checkGoogle(
  params: NapCheckParams,
  signal: AbortSignal
): Promise<NapCheckResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("nap-checker: SERPAPI_KEY not set, skipping Google");
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
      nameMatch: false,
      addressMatch: null,
      phoneMatch: null,
      issues: ["Business not found in Google Maps results"],
    };
  }

  const nameMatch = isBusinessMentioned(
    result.title || "",
    params.businessName
  );
  const addrMatch = addressMatches(result.address, params.address);
  const phMatch = phoneMatches(result.phone, params.phone);

  const issues: string[] = [];
  if (!nameMatch.cited) issues.push("Business name not matched in Google listing");
  if (addrMatch === false) issues.push("Address mismatch in Google listing");
  if (phMatch === false) issues.push("Phone mismatch in Google listing");

  return {
    platform: "google",
    nameMatch: nameMatch.cited,
    addressMatch: addrMatch,
    phoneMatch: phMatch,
    listingUrl: result.link || result.place_id_search || undefined,
    issues,
  };
}

/**
 * Check Yelp Fusion API for NAP consistency.
 */
async function checkYelp(
  params: NapCheckParams,
  signal: AbortSignal
): Promise<NapCheckResult> {
  const apiKey = process.env.YELP_FUSION_KEY;
  if (!apiKey) {
    console.warn("nap-checker: YELP_FUSION_KEY not set, skipping Yelp");
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
      nameMatch: false,
      addressMatch: null,
      phoneMatch: null,
      issues: ["Business not found in Yelp results"],
    };
  }

  const nameMatch = isBusinessMentioned(biz.name || "", params.businessName);
  const yelpAddress = biz.location?.display_address?.join(", ");
  const addrMatch = addressMatches(yelpAddress, params.address);
  const phMatch = phoneMatches(biz.phone, params.phone);

  const issues: string[] = [];
  if (!nameMatch.cited) issues.push("Business name not matched in Yelp listing");
  if (addrMatch === false) issues.push("Address mismatch in Yelp listing");
  if (phMatch === false) issues.push("Phone mismatch in Yelp listing");

  return {
    platform: "yelp",
    nameMatch: nameMatch.cited,
    addressMatch: addrMatch,
    phoneMatch: phMatch,
    listingUrl: biz.url || undefined,
    issues,
  };
}

/**
 * Check NAP (Name, Address, Phone) consistency across directories.
 * MVP: Google Maps (SerpAPI) + Yelp (Fusion API).
 * Gracefully skips platforms when API keys are missing.
 */
export async function checkNap(
  params: NapCheckParams
): Promise<NapCheckResult[]> {
  type CheckFn = (
    params: NapCheckParams,
    signal: AbortSignal
  ) => Promise<NapCheckResult>;

  const checkers: CheckFn[] = [checkGoogle, checkYelp];

  const settled = await Promise.allSettled(
    checkers.map((checker) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DIRECTORY_TIMEOUT_MS);

      return checker(params, controller.signal).finally(() =>
        clearTimeout(timeout)
      );
    })
  );

  const results: NapCheckResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    }
    // Rejected means either missing API key or network error — skip silently
  }

  return results;
}
