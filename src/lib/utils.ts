export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Wraps a promise with an AbortController timeout.
 * Rejects with a TimeoutError if the timeout expires.
 */
export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  return fn(controller.signal)
    .catch((error) => {
      if (didTimeout && error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(timeoutMs);
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
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
