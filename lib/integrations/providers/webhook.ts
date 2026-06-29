import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

/** Constant-time string compare that tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Generic inbound webhook for no-code pipes (Zapier/Make). Senders can't compute
 * a provider-style HMAC, so we authenticate with the unguessable URL token plus a
 * shared bearer secret the user sets as a header. Lower integrity than a native
 * signed webhook, far higher reach (any tool in Zapier's catalog).
 */
function verify({ rawBody: _rawBody, headers, secret }: VerifyArgs): boolean {
  if (!secret) return false;
  const auth = headers["authorization"] ?? headers["Authorization"];
  const bearer = auth?.replace(/^Bearer\s+/i, "");
  const custom = headers["x-webhook-secret"] ?? headers["X-Webhook-Secret"];
  const presented = bearer || custom;
  if (!presented) return false;
  return safeEqual(presented, secret);
}

function parse(rawBody: string, _headers: Record<string, string>): ProviderEvent[] {
  const body = JSON.parse(rawBody);
  // Prefer a user-supplied stable id for dedup; fall back to a body hash so an
  // identical retry still dedups (a re-send of changed data is a new event).
  const externalId =
    body?.externalId ??
    body?.eventId ??
    body?.id ??
    crypto.createHash("sha256").update(rawBody).digest("hex");
  return [
    {
      externalId: String(externalId),
      type: String(body?.type ?? "incoming.event"),
      data: body,
    },
  ];
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  // Default: pass everything; the significance gate is the real filter.
  const allow = config.events?.length ? config.events : null;
  return allow ? allow.includes(event.type) : true;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v) return [v];
  return [];
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const b = event.data as any;
  const evidence =
    typeof b?.evidence === "string"
      ? b.evidence
      : b?.evidence != null
        ? JSON.stringify(b.evidence)
        : "";

  return {
    title: String(b?.title ?? b?.type ?? "Incoming event"),
    description: String(b?.description ?? ""),
    evidence,
    links: asStringArray(b?.links),
    metadata: {
      provider: "webhook",
      type: event.type,
      externalId: event.externalId,
    },
  };
}

export const webhookAdapter: IntegrationProviderAdapter = {
  slug: "webhook",
  provider: "WEBHOOK",
  label: "Incoming Webhook (Zapier/Make)",
  events: [],
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
