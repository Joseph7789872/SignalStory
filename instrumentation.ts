// Next.js runs register() once at server start (stable since Next 15).
// Production boot assertion: rateLimit() silently no-ops when Upstash is
// unconfigured, which would leave every expensive LLM endpoint uncapped —
// refuse to boot instead of failing open.
export async function register() {
  if (process.env.NODE_ENV === "production") {
    const missing = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"].filter(
      (k) => !process.env[k],
    );
    if (missing.length) {
      throw new Error(
        `[startup] Rate limiting misconfigured — missing: ${missing.join(", ")}. ` +
          "Launching production without rate limiting means uncapped abuse/LLM cost.",
      );
    }
  }
}
