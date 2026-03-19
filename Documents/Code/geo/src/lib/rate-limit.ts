interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

interface RateLimitOptions {
  /** Window size in milliseconds */
  interval: number;
  /** Max requests per window */
  limit: number;
}

/**
 * In-memory rate limiter using a Map with TTL cleanup.
 * Returns a check function that tracks requests per identifier.
 */
export function rateLimit(options: RateLimitOptions) {
  const { interval, limit } = options;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup of expired entries every 60s
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow GC to collect the interval if the module is unloaded
  if (cleanup.unref) {
    cleanup.unref();
  }

  return function check(identifier: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(identifier);

    // No entry or expired — start fresh window
    if (!entry || entry.expiresAt <= now) {
      store.set(identifier, { count: 1, expiresAt: now + interval });
      return { success: true, remaining: limit - 1 };
    }

    // Within window — increment
    entry.count += 1;

    if (entry.count > limit) {
      return { success: false, remaining: 0 };
    }

    return { success: true, remaining: limit - entry.count };
  };
}
