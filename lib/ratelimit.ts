import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Serverless-friendly rate limiting (Vercel + Upstash). When the UPSTASH_* env
// is unset the helper is a no-op pass-through, so local dev and `next build`
// need no Redis. Clients are lazily constructed (never at import time).

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export type LimiterName = "signals" | "webhook" | "enrich";

function getLimiter(name: LimiterName, r: Redis): Ratelimit {
  let lim = limiters.get(name);
  if (lim) return lim;
  // Sliding-window budgets. signals: per-org submissions; webhook: per-IP flood
  // guard; enrich: per-org URL-scrape + LLM (expensive, so keep it tight).
  const limiter =
    name === "signals"
      ? Ratelimit.slidingWindow(30, "1 h")
      : name === "webhook"
        ? Ratelimit.slidingWindow(120, "1 m")
        : Ratelimit.slidingWindow(10, "1 h");
  lim = new Ratelimit({ redis: r, limiter, prefix: `rl:${name}` });
  limiters.set(name, lim);
  return lim;
}

export type RateLimitResult = { ok: boolean; retryAfter?: number };

/**
 * Returns { ok: true } when allowed (or when Upstash is not configured).
 * On limit, ok:false with retryAfter (seconds until the window resets).
 */
export async function rateLimit(
  key: string,
  name: LimiterName,
): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r) return { ok: true }; // no-op when unconfigured
  const res = await getLimiter(name, r).limit(key);
  if (res.success) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
}
