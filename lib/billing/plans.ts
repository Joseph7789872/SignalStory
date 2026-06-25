// Single source of truth for billing tiers. Stripe price ids are env-driven
// (same `process.env.X ?? default` pattern as lib/agents/models.ts) so the
// catalogue can change without code edits. Quota + hard spend cap are derived
// from the plan, never stored on the Subscription row.

export type PlanId = "FREE" | "STARTER" | "PRO";

export type Plan = {
  id: PlanId;
  label: string;
  /** Signals an org may run per billing period before the hard block. */
  monthlySignals: number;
  /** Per-org-per-period LLM spend ceiling, defense-in-depth over the per-run guardrail. */
  hardSpendCapUsd: number;
  /** Display price, USD/month (UI only — Stripe is the source of truth). */
  priceUsd: number;
  /** Stripe price id; null for FREE (no Checkout). */
  priceId: string | null;
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    label: "Free",
    monthlySignals: 5,
    hardSpendCapUsd: 5,
    priceUsd: 0,
    priceId: null,
  },
  STARTER: {
    id: "STARTER",
    label: "Starter",
    monthlySignals: 50,
    hardSpendCapUsd: 50,
    priceUsd: 29,
    priceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    monthlySignals: 250,
    hardSpendCapUsd: 250,
    priceUsd: 99,
    priceId: process.env.STRIPE_PRICE_PRO || null,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** Narrow an arbitrary string (DB value / Stripe metadata) to a known plan. */
export function toPlanId(value: string | null | undefined): PlanId {
  return value && value in PLANS ? (value as PlanId) : "FREE";
}

export function getPlan(value: string | null | undefined): Plan {
  return PLANS[toPlanId(value)];
}

/** Resolve a Stripe price id back to a plan (used by the webhook). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const match = PLAN_IDS.find((id) => PLANS[id].priceId === priceId);
  return match ?? null;
}
