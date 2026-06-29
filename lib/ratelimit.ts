import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Serverless-friendly rate limiting (Vercel + Upstash). When the UPSTASH_* env
// is unset the helper is a no-op pass-through, so local dev and `next build`
// need no Redis. Clients are lazily constructed (never at import time).

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();
let warnedNoRedis = false;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Loudly flag (once) that rate limiting is disabled in production so a
    // missing Upstash config doesn't silently remove all abuse protection.
    if (!warnedNoRedis && process.env.NODE_ENV === "production") {
      warnedNoRedis = true;
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN unset — rate limiting is DISABLED. " +
          "Configure Upstash to protect expensive endpoints in production.",
      );
    }
    return null;
  }
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export type LimiterName = "signals" | "webhook" | "enrich" | "knowledge";

function getLimiter(name: LimiterName, r: Redis): Ratelimit {
  let lim = limiters.get(name);
  if (lim) return lim;
  // Sliding-window budgets. signals: per-org submissions; webhook: per-connection
  // flood guard; enrich/knowledge: per-org URL-scrape + LLM/embeddings (expensive,
  // so keep them tight).
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
