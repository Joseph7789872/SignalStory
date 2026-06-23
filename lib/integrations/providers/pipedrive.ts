import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

// "added.deal" rarely lands here (a new deal is "open"); the content-worthy
// case is a deal moving to "won", caught by `updated.deal` + the wonDealsOnly filter.
const DEFAULT_EVENTS = ["updated.deal", "added.deal"];

/** Constant-time compare that tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Pipedrive webhooks authenticate with HTTP Basic Auth (username + password set
 * on the webhook), not an HMAC signature — it sends `Authorization: Basic
 * base64(user:pass)`. We store the connection secret as the literal "user:pass"
 * and compare against the reconstructed header. The unguessable URL token is the
 * second factor.
 */
function verify({ headers, secret }: VerifyArgs): boolean {
  const auth = headers["authorization"] ?? headers["Authorization"];
  if (!auth) return false;
  const expected = "Basic " + Buffer.from(secret).toString("base64");
  return safeEqual(auth, expected);
}

// The changed object lives at `current` (v1) or `data` (v2).
function dealObject(body: any): any {
  return body?.current ?? body?.data ?? {};
}

// Normalize v2 action names (change/create/delete) to the v1 vocabulary so the
// canonical type is version-independent.
const ACTION_ALIASES: Record<string, string> = {
  change: "updated",
  updated: "updated",
  create: "added",
  added: "added",
  delete: "deleted",
  deleted: "deleted",
};

function parse(rawBody: string, _headers: Record<string, string>): ProviderEvent[] {
  const body = JSON.parse(rawBody);
  const meta = body?.meta ?? {};
  // Stable per-delivery id (NOT meta.webhook_id, which is constant per webhook).
  // v2 may use correlation_id; fall back to a body hash so we never drop an event.
  const externalId = String(
    meta.id ??
      meta.correlation_id ??
      crypto.createHash("sha256").update(rawBody).digest("hex"),
  );
  const object = meta.object ?? meta.entity ?? "";
  const action = ACTION_ALIASES[meta.action] ?? meta.action ?? "";
  // Canonical type, e.g. "updated.deal", regardless of webhook version.
  const type = object && action ? `${action}.${object}` : (body.event ?? object);
  return [{ externalId, type, data: body }];
}

function isDealEvent(event: ProviderEvent): boolean {
  return event.type.endsWith(".deal");
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  const allow = config.events?.length ? config.events : DEFAULT_EVENTS;
  if (!allow.includes(event.type)) return false;
  // Default to won-only for deals — most CRM updates aren't content-worthy.
  const wonOnly = config.wonDealsOnly !== false;
  if (isDealEvent(event) && wonOnly) {
    const status = dealObject(event.data)?.status;
    if (status !== "won") return false;
  }
  return true;
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const body = event.data as any;
  const deal = dealObject(body);
  const title = deal?.title ?? "a deal";
  const value =
    typeof deal?.value === "number"
      ? `${deal.value.toLocaleString()}${deal.currency ? ` ${deal.currency}` : ""}`
      : null;
  const won = deal?.status === "won";

  let signalTitle = `Pipedrive: ${event.type}`;
  let description = `A Pipedrive ${event.type} event occurred.`;
  if (isDealEvent(event)) {
    if (won) {
      signalTitle = `Closed a deal: ${title}${value ? ` (${value})` : ""}`;
      description =
        `Won the "${title}" deal in Pipedrive${value ? ` worth ${value}` : ""}.` +
        ` A closed-won deal is a strong proof point worth a story.`;
    } else if (event.type === "added.deal") {
      signalTitle = `New deal created: ${title}`;
      description = `A new "${title}" deal was created in Pipedrive.`;
    } else {
      signalTitle = `Deal updated: ${title}`;
      description = `The "${title}" deal was updated in Pipedrive.`;
    }
  }

  return {
    title: signalTitle,
    description,
    evidence: [
      deal?.status ? `Status: ${deal.status}` : "",
      value ? `Value: ${value}` : "",
      deal?.stage_id ? `Stage id: ${deal.stage_id}` : "",
      deal?.org_name ? `Org: ${deal.org_name}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    links: [],
    metadata: {
      provider: "pipedrive",
      type: event.type,
      externalId: event.externalId,
    },
  };
}

export const pipedriveAdapter: IntegrationProviderAdapter = {
  slug: "pipedrive",
  provider: "PIPEDRIVE",
  label: "Pipedrive",
  events: DEFAULT_EVENTS.map((type) => ({ type, label: type })),
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
