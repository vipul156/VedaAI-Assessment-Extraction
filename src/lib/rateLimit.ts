interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Simple fixed-window in-memory limiter. Fine for a single-instance
 * deployment without a database (per assignment scope).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      b.hits = b.hits.filter((t) => now - t < windowMs);
      if (b.hits.length === 0) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}
