import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

const DEFAULT_EVENTS = [
  "charge.succeeded",
  "invoice.paid",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

/** Verify Stripe's `stripe-signature` header: HMAC-SHA256(secret, `${t}.${body}`). */
function verify({ rawBody, headers, secret }: VerifyArgs): boolean {
  const header = headers["stripe-signature"] ?? headers["Stripe-Signature"];
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parse(rawBody: string, _headers: Record<string, string>): ProviderEvent[] {
  const e = JSON.parse(rawBody);
  if (!e?.id || !e?.type) return [];
  // Stripe delivers one event per webhook; the object lives at data.object.
  return [{ externalId: e.id, type: e.type, data: e.data?.object ?? e }];
}

function amountUsd(obj: any): number | null {
  // charge.amount / invoice.amount_paid are in cents; subscriptions vary.
  const cents =
    obj?.amount ??
    obj?.amount_paid ??
    obj?.items?.data?.[0]?.price?.unit_amount ??
    obj?.plan?.amount;
  return typeof cents === "number" ? cents / 100 : null;
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  const allow = config.events?.length ? config.events : DEFAULT_EVENTS;
  if (!allow.includes(event.type)) return false;
  // Money events can be threshold-gated; subscription lifecycle always passes.
  if (
    config.minAmountUsd != null &&
    (event.type === "charge.succeeded" || event.type === "invoice.paid")
  ) {
    const amt = amountUsd(event.data);
    if (amt != null && amt < config.minAmountUsd) return false;
  }
  return true;
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const o = event.data as any;
  const amt = amountUsd(o);
  const money = amt != null ? `$${amt.toLocaleString()}` : "an amount";
  const links: string[] = [o?.receipt_url, o?.hosted_invoice_url].filter(
    Boolean,
  );

  let title = "Stripe event";
  let description = "";
  switch (event.type) {
    case "charge.succeeded":
      title = `New payment received: ${money}`;
      description = `A Stripe charge of ${money} succeeded.`;
      break;
    case "invoice.paid":
      title = `Invoice paid: ${money}`;
      description = `A Stripe invoice for ${money} was paid.`;
      break;
    case "customer.subscription.created":
      title = `New subscription started${amt != null ? ` (${money}/period)` : ""}`;
      description = `A new Stripe subscription was created.`;
      break;
    case "customer.subscription.updated":
      title = `Subscription changed${amt != null ? ` (${money}/period)` : ""}`;
      description = `An existing Stripe subscription was updated (upgrade, downgrade, or plan change).`;
      break;
    case "customer.subscription.deleted":
      title = `Subscription canceled (churn)`;
      description = `A Stripe subscription was canceled — a churn event worth understanding.`;
      break;
    default:
      title = `Stripe: ${event.type}`;
      description = `A Stripe ${event.type} event occurred.`;
  }

  return {
    title,
    description,
    evidence: [
      amt != null ? `Amount: ${money}` : "",
      o?.currency ? `Currency: ${String(o.currency).toUpperCase()}` : "",
      o?.customer ? `Customer: ${o.customer}` : "",
      o?.status ? `Status: ${o.status}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    links,
    metadata: { provider: "stripe", type: event.type, externalId: event.externalId },
  };
}

export const stripeAdapter: IntegrationProviderAdapter = {
  slug: "stripe",
  provider: "STRIPE",
  label: "Stripe",
  events: DEFAULT_EVENTS.map((type) => ({ type, label: type })),
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
