import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

const DEFAULT_EVENTS = ["Issue.update", "Project.update"];

/** Verify Linear's `linear-signature`: HMAC-SHA256(secret, rawBody) hex. */
function verify({ rawBody, headers, secret }: VerifyArgs): boolean {
  if (!secret) return false;
  const header = headers["linear-signature"] ?? headers["Linear-Signature"];
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
  // Linear carries a per-delivery UUID in a header; webhookId is constant.
  const delivery = headers["linear-delivery"] ?? headers["Linear-Delivery"];
  if (!delivery || !body?.type || !body?.action) return [];
  return [
    { externalId: delivery, type: `${body.type}.${body.action}`, data: body },
  ];
}

// Issues carry a state object ({name,type}); projects carry a string state.
function isCompleted(data: any): boolean {
  if (data?.completedAt) return true;
  const state = data?.state;
  if (typeof state === "string") return state === "completed";
  return state?.type === "completed";
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  const allow = config.events?.length ? config.events : DEFAULT_EVENTS;
  if (!allow.includes(event.type)) return false;
  // Default: only ingest things that actually shipped/completed.
  const completedOnly = config.completedOnly !== false;
  if (completedOnly && event.type.endsWith(".update")) {
    if (!isCompleted((event.data as any)?.data)) return false;
  }
  return true;
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const body = event.data as any;
  const d = body?.data ?? {};
  const name = d.title ?? d.name ?? "an item";
  const kind = body?.type === "Project" ? "project" : "issue";

  return {
    title: `Shipped: ${name}`,
    description:
      `A Linear ${kind} was completed: "${name}".` +
      (d.description ? `\n\n${d.description}` : ""),
    evidence: [
      d.identifier ? `Ref: ${d.identifier}` : "",
      typeof d.state === "object" && d.state?.name ? `State: ${d.state.name}` : "",
      typeof d.state === "string" ? `State: ${d.state}` : "",
      d.priorityLabel ? `Priority: ${d.priorityLabel}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    links: [body?.url, d.url].filter(Boolean),
    metadata: {
      provider: "linear",
      type: event.type,
      externalId: event.externalId,
    },
  };
}

export const linearAdapter: IntegrationProviderAdapter = {
  slug: "linear",
  provider: "LINEAR",
  label: "Linear",
  events: DEFAULT_EVENTS.map((type) => ({ type, label: type })),
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
