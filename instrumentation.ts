// Next.js runs register() once at server start (stable since Next 15).
// Production boot assertions — refuse to boot instead of failing open:
// - rateLimit() silently no-ops when Upstash is unconfigured, which would
//   leave every expensive LLM endpoint uncapped.
// - A missing Inngest key (or a stray INNGEST_DEV=1) doesn't crash anything;
//   it silently strands every submitted signal in QUEUED forever.
export async function register() {
  if (process.env.NODE_ENV === "production") {
    const missing = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
    ].filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(
        `[startup] Production env misconfigured — missing: ${missing.join(", ")}. ` +
          "Without Upstash, rate limiting no-ops (uncapped abuse/LLM cost); " +
          "without Inngest keys, submitted signals are never processed.",
      );
    }
    if (process.env.INNGEST_DEV === "1") {
      throw new Error(
        "[startup] INNGEST_DEV=1 is set in production — the Inngest SDK would " +
          "target a local dev server that doesn't exist. Unset it.",
      );
    }
  }
}
