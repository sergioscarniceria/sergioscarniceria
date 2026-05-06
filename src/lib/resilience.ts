/**
 * Resilience utilities for offline-tolerant operation.
 * - Retry wrapper for Supabase queries
 * - localStorage cache for critical data (products, customers)
 * - Online/offline detection
 */

/* ─── Retry wrapper ─── */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, delayMs = 1000, backoff = true } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const wait = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/**
 * Supabase query with retry — works with the { data, error } pattern.
 * Returns cached data on total failure if a cache key is provided.
 */
export async function resilientQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  cacheKey?: string
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await queryFn();
      if (!result.error && result.data != null) {
        // Success — update cache
        if (cacheKey) {
          try {
            localStorage.setItem(
              `cache_${cacheKey}`,
              JSON.stringify({ data: result.data, ts: Date.now() })
            );
          } catch {
            // localStorage full or unavailable — ignore
          }
        }
        return { ...result, fromCache: false };
      }
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }

    // Wait before retry (1s, 2s, 4s)
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  // All retries failed — try cache
  if (cacheKey) {
    try {
      const cached = localStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Accept cache up to 24 hours old
        if (parsed.data && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
          return { data: parsed.data as T, error: null, fromCache: true };
        }
      }
    } catch {
      // Cache read failed
    }
  }

  return { data: null, error: lastError, fromCache: false };
}

/* ─── Connection monitor ─── */
type ConnectionListener = (online: boolean) => void;
const listeners = new Set<ConnectionListener>();
let _isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    _isOnline = true;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener("offline", () => {
    _isOnline = false;
    listeners.forEach((fn) => fn(false));
  });
}

export function isOnline(): boolean {
  return _isOnline;
}

export function onConnectionChange(fn: ConnectionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
