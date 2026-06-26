import * as Sentry from "@sentry/nextjs";

// One consistent error sink. Always logs to the console; additionally reports to
// Sentry when SENTRY_DSN is set. Sentry is initialized lazily on first capture
// (no DSN = no init = no-op), so build/dev/test need no Sentry config and we
// avoid the heavier build-time instrumentation until it's needed.
//
// This is the explicit-capture path the Phase 1 plan calls for (captureException
// in catch blocks). Full auto-instrumentation (instrumentation.ts +
// withSentryConfig) can be layered on later without changing call sites.

let initialized = false;

function ensureSentry(): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({ dsn, tracesSampleRate: 0 });
  initialized = true;
  return true;
}

/**
 * Log an unexpected error. `scope` is a short tag (e.g. "pipeline", "billing").
 * Never throws — safe to call from any catch block.
 */
export function logError(
  scope: string,
  err: unknown,
  meta?: Record<string, unknown>,
): void {
  try {
    const detail = err instanceof Error ? (err.stack ?? err.message) : err;
    console.error(`[${scope}]`, detail, meta ?? "");
    if (ensureSentry()) {
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { scope },
        extra: meta,
      });
    }
  } catch {
    // logging must never break the caller
  }
}
