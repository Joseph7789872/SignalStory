import type { IntegrationProvider } from "@prisma/client";

/** The shape the Event Listener agent consumes (matches POST /api/signals). */
export type SignalRawInput = {
  title: string;
  description: string;
  evidence: string;
  links: string[];
  metadata?: Record<string, unknown>;
};

/** A single discrete event extracted from a provider webhook payload. */
export type ProviderEvent = {
  externalId: string; // stable provider event id — used for dedup
  type: string; // provider event type, e.g. "charge.succeeded"
  data: unknown; // the relevant event object, passed to toRawInput
};

/** Per-connection ingestion config (stored on IntegrationConnection.config). */
export type ConnectionConfig = {
  events?: string[]; // event-type allowlist; empty/undefined = adapter default
  minAmountUsd?: number; // coarse threshold for money events
  [k: string]: unknown;
};

export type VerifyArgs = {
  rawBody: string;
  headers: Record<string, string>;
  secret: string;
};

/**
 * One adapter per third-party source. Mirrors the LLM provider layer
 * (lib/agents/provider.ts): a thin, swappable interface so adding a source is
 * a single new file registered in registry.ts.
 */
export interface IntegrationProviderAdapter {
  slug: string; // URL segment, e.g. "stripe"
  provider: IntegrationProvider; // Prisma enum, e.g. "STRIPE"
  label: string;
  events: { type: string; label: string }[]; // selectable event types for the UI
  /** Verify the webhook signature. Return false to reject (→ 401). */
  verify(args: VerifyArgs): boolean;
  /** Extract discrete events. Headers are included because some providers
   *  (e.g. GitHub) carry the event type / delivery id in headers, not the body. */
  parse(rawBody: string, headers: Record<string, string>): ProviderEvent[];
  /** Coarse, pre-pipeline filter (no LLM cost). */
  shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean;
  /** Map an event to the Signal rawInput the Event Listener consumes. */
  toRawInput(event: ProviderEvent): SignalRawInput;
}
