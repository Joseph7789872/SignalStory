import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

const DEFAULT_EVENTS = ["record.updated", "list-entry.created"];

/** Verify Attio's `attio-signature`: HMAC-SHA256(secret, rawBody) hex. */
function verify({ rawBody, headers, secret }: VerifyArgs): boolean {
  const header =
    headers["attio-signature"] ??
    headers["Attio-Signature"] ??
    headers["x-attio-signature"] ??
    headers["X-Attio-Signature"];
  if (!header) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parse(rawBody: string, headers: Record<string, string>): ProviderEvent[] {
  const body = JSON.parse(rawBody);
  // Attio dedups on the Idempotency-Key header; a delivery may batch events[].
  const key =
    headers["idempotency-key"] ?? headers["Idempotency-Key"] ?? null;
  const list: any[] = Array.isArray(body?.events)
    ? body.events
    : body?.event_type
      ? [body]
      : [];
  return list.map((evt, i) => ({
    externalId: key ? (list.length > 1 ? `${key}:${i}` : key) : JSON.stringify(evt.id ?? i),
    type: evt.event_type ?? "record.updated",
    data: evt,
  }));
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  const allow = config.events?.length ? config.events : DEFAULT_EVENTS;
  return allow.includes(event.type);
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const e = event.data as any;
  const id = e?.id ?? {};
  const objectId = id.object_id ?? e?.parent_object_id ?? "";
  const recordId = id.record_id ?? e?.parent_record_id ?? "";

  let title = `Attio: ${event.type}`;
  let description = `An Attio ${event.type} event occurred.`;
  if (event.type === "list-entry.created") {
    title = `New CRM list entry added`;
    description = `A record was added to a list in Attio — often a new qualified lead or deal.`;
  } else if (event.type === "record.updated") {
    title = `CRM record updated`;
    description = `A record was updated in Attio (e.g. a deal advanced or a company changed).`;
  }

  return {
    title,
    description,
    evidence: [
      objectId ? `Object: ${objectId}` : "",
      recordId ? `Record: ${recordId}` : "",
      e?.actor?.type ? `Actor: ${e.actor.type}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    links: [],
    metadata: {
      provider: "attio",
      type: event.type,
      externalId: event.externalId,
    },
  };
}

export const attioAdapter: IntegrationProviderAdapter = {
  slug: "attio",
  provider: "ATTIO",
  label: "Attio",
  events: DEFAULT_EVENTS.map((type) => ({ type, label: type })),
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
