/**
 * Validates that a URL is safe to fetch server-side (SSRF protection).
 * Blocks private IPs, localhost, cloud metadata endpoints, and non-public hostnames.
 */

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i,
  /^\[?fe[89ab][0-9a-f]:/i,   // fe80::/10 link-local
  /^\[?f[cd][0-9a-f]{2}:/i,   // fc00::/7 unique-local
  /^metadata\.google\.internal$/i,
  /^metadata\.internal$/i,
];

export function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Block non-HTTP(S) schemes
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return true;
    }

    // Block IP-based URLs and private/reserved ranges
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    // Block hostnames without a dot (e.g., "intranet", "admin")
    if (!hostname.includes(".")) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}
