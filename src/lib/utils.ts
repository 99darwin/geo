/**
 * Wraps a promise with an AbortController timeout.
 * Rejects with an error if the timeout expires.
 */
export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fn(controller.signal).finally(() => clearTimeout(timer));
}

/**
 * Normalize a URL domain: strip www., trailing slashes, lowercase.
 */
export function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "").replace(/\/+$/, "");
  }
}
