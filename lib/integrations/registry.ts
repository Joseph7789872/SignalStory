import type { IntegrationProviderAdapter } from "./types";
import { stripeAdapter } from "./providers/stripe";
import { githubAdapter } from "./providers/github";

// Provider-agnostic registry (mirrors lib/agents/registry.ts). Keyed by the URL
// slug used in /api/webhooks/[provider]/[token]. Add a source = one new adapter.
export const ADAPTERS: Record<string, IntegrationProviderAdapter> = {
  [stripeAdapter.slug]: stripeAdapter,
  [githubAdapter.slug]: githubAdapter,
};

export function getAdapter(slug: string): IntegrationProviderAdapter | null {
  return ADAPTERS[slug?.toLowerCase()] ?? null;
}

/** Resolve an adapter by its Prisma enum value (e.g. "STRIPE"). */
export function getAdapterByProvider(
  provider: string,
): IntegrationProviderAdapter | null {
  return (
    Object.values(ADAPTERS).find((a) => a.provider === provider) ?? null
  );
}

export const PROVIDERS = Object.values(ADAPTERS).map((a) => ({
  slug: a.slug,
  provider: a.provider,
  label: a.label,
  events: a.events,
}));
