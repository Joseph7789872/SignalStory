import type { IntegrationProviderAdapter } from "./types";
import { githubAdapter } from "./providers/github";
import { pipedriveAdapter } from "./providers/pipedrive";
import { attioAdapter } from "./providers/attio";
import { linearAdapter } from "./providers/linear";
import { webhookAdapter } from "./providers/webhook";

// Provider-agnostic registry (mirrors lib/agents/registry.ts). Keyed by the URL
// slug used in /api/webhooks/[provider]/[token]. Add a source = one new adapter.
export const ADAPTERS: Record<string, IntegrationProviderAdapter> = {
  [pipedriveAdapter.slug]: pipedriveAdapter,
  [attioAdapter.slug]: attioAdapter,
  [linearAdapter.slug]: linearAdapter,
  [githubAdapter.slug]: githubAdapter,
  [webhookAdapter.slug]: webhookAdapter,
};

export function getAdapter(slug: string): IntegrationProviderAdapter | null {
  return ADAPTERS[slug?.toLowerCase()] ?? null;
}

/** Resolve an adapter by its Prisma enum value (e.g. "PIPEDRIVE"). */
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
