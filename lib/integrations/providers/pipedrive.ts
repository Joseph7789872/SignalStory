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

/** Verify Pipedrive's `x-pipedrive-signature`: HMAC-SHA256(secret, rawBody) hex. */
function verify({ rawBody, headers, secret }: VerifyArgs): boolean {
  const header =
    headers["x-pipedrive-signature"] ?? headers["X-Pipedrive-Signature"];
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

// The changed object lives at `current` (v1) or `data` (v2).
function dealObject(body: any): any {
  return body?.current ?? body?.data ?? {};
}

function parse(rawBody: string, _headers: Record<string, string>): ProviderEvent[] {
  const body = JSON.parse(rawBody);
  const meta = body?.meta ?? {};
  // Stable per-delivery id (NOT meta.webhook_id, which is constant per webhook).
  const externalId = meta.id != null ? String(meta.id) : null;
  if (externalId == null) return [];
  const object = meta.object ?? meta.entity ?? "";
  const type = body.event ?? (meta.action ? `${meta.action}.${object}` : object);
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
