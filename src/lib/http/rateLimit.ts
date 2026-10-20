interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window rate limiter (in-memory).
 * Returns remaining attempts; throws nothing — caller checks `ok`.
 */
export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(params.key, {
      count: 1,
      resetAt: now + params.windowMs,
    });
    return {
      ok: true,
      remaining: params.limit - 1,
      retryAfterSec: Math.ceil(params.windowMs / 1000),
    };
  }

  if (existing.count >= params.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: params.limit - existing.count,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
