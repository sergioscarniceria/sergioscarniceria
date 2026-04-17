/**
 * In-memory rate limiter for API routes.
 * Limits requests per IP within a sliding window.
 *
 * NOTE: This resets on each serverless cold start.
 * For production at scale, use Redis or Upstash. For this app's
 * traffic level, in-memory is sufficient and zero-dependency.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60s to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

type RateLimitConfig = {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
};

/**
 * Check rate limit for a given key (usually IP + route).
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true };
  }

  if (entry.count < config.limit) {
    entry.count++;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Extract client IP from request headers (works on Vercel).
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
