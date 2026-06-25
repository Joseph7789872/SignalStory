import Stripe from "stripe";

// Lazy client: never construct at module top-level so `next build` and any
// import that doesn't actually call Stripe works without STRIPE_SECRET_KEY
// (same rule the LLM adapters follow).

let client: Stripe | null = null;

/** True when Stripe is configured. Routes should 503 gracefully when false. */
export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Returns the singleton Stripe client; throws if the secret key is unset. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!client) client = new Stripe(key);
  return client;
}
