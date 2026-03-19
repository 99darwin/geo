import Redis from "ioredis";

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

// ── Redis client (singleton, lazy) ──────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableReadyCheck: false,
  });

  redis.on("error", (err) => {
    console.error("[rate-limit] Redis error:", err.message);
  });

  redis.connect().catch(() => {
    redis = null;
  });

  return redis;
}

// Atomic Lua script: INCR + conditional PEXPIRE in a single round trip
const RATE_LIMIT_LUA = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

// ── In-memory fallback ──────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

function createInMemoryChecker(options: RateLimitOptions) {
  const { interval, limit } = options;
  const store = new Map<string, RateLimitEntry>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  if (cleanup.unref) {
    cleanup.unref();
  }

  return async function check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || entry.expiresAt <= now) {
      store.set(identifier, { count: 1, expiresAt: now + interval });
      return { success: true, remaining: limit - 1 };
    }

    entry.count += 1;

    if (entry.count > limit) {
      return { success: false, remaining: 0 };
    }

    return { success: true, remaining: limit - entry.count };
  };
}

// ── Redis-backed checker ────────────────────────────────────────────────────

function createRedisChecker(
  client: Redis,
  options: RateLimitOptions,
  fallback: (identifier: string) => Promise<RateLimitResult>
) {
  const { interval, limit } = options;

  return async function check(identifier: string): Promise<RateLimitResult> {
    const key = `rl:${identifier}`;

    try {
      const count = (await client.eval(
        RATE_LIMIT_LUA,
        1,
        key,
        interval.toString()
      )) as number;

      if (count > limit) {
        return { success: false, remaining: 0 };
      }

      return { success: true, remaining: limit - count };
    } catch (err) {
      console.error("[rate-limit] Redis check failed, falling back to in-memory:", err);
      return fallback(identifier);
    }
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Rate limiter with Redis backend (via REDIS_URL) and in-memory fallback.
 * Falls back to in-memory if Redis is unavailable or errors.
 */
export function rateLimit(options: RateLimitOptions) {
  const inMemoryCheck = createInMemoryChecker(options);

  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    console.warn(
      "[rate-limit] REDIS_URL not configured in production. Rate limiting is per-isolate only."
    );
  }

  return async function check(identifier: string): Promise<RateLimitResult> {
    const client = getRedis();
    if (!client) {
      return inMemoryCheck(identifier);
    }

    const redisCheck = createRedisChecker(client, options, inMemoryCheck);
    return redisCheck(identifier);
  };
}
