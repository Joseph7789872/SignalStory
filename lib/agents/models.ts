// Provider-agnostic model config. Agents reference a TIER; the active provider
// resolves the tier to a concrete model. Model IDs are env-overridable so you
// can point at newer models without code changes.

export type Provider = "anthropic" | "openai";
export type Tier = "extraction" | "reasoning" | "writing";

export const TIER = {
  EXTRACTION: "extraction",
  REASONING: "reasoning",
  WRITING: "writing",
} as const;

const DEFAULT_MODELS: Record<Provider, Record<Tier, string>> = {
  anthropic: {
    extraction: "claude-haiku-4-5",
    reasoning: "claude-opus-4-8",
    writing: "claude-sonnet-4-6",
  },
  // OpenAI defaults use the stable GPT-4.1 family. Override per tier via env
  // (e.g. OPENAI_MODEL_REASONING=gpt-5) if you have access to newer models.
  openai: {
    extraction: "gpt-4.1-mini",
    reasoning: "gpt-4.1",
    writing: "gpt-4.1",
  },
};

/** Active provider: explicit LLM_PROVIDER wins, else infer from available key. */
export function resolveProvider(): Provider {
  const p = process.env.LLM_PROVIDER?.toLowerCase();
  if (p === "openai" || p === "anthropic") return p;
  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY)
    return "openai";
  return "anthropic";
}

export function resolveModel(provider: Provider, tier: Tier): string {
  const envKey = `${provider.toUpperCase()}_MODEL_${tier.toUpperCase()}`;
  return process.env[envKey] || DEFAULT_MODELS[provider][tier];
}

// Pricing (USD per 1M tokens). Approximate for OpenAI; used only for the
// in-app cost estimate, not billing. Unknown models fall back conservatively.
type Pricing = { inputPerM: number; outputPerM: number };
const PRICING: Record<string, Pricing> = {
  "claude-opus-4-8": { inputPerM: 5, outputPerM: 25 },
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
  "gpt-4.1": { inputPerM: 2, outputPerM: 8 },
  "gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  "gpt-4.1-nano": { inputPerM: 0.1, outputPerM: 0.4 },
};

/** Cached/cache-read input tokens are billed at ~0.1x input rate. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): number {
  const p = PRICING[model] ?? { inputPerM: 5, outputPerM: 15 };
  const freshInput = Math.max(0, inputTokens - cachedTokens);
  const cost =
    (freshInput / 1_000_000) * p.inputPerM +
    (cachedTokens / 1_000_000) * p.inputPerM * 0.1 +
    (outputTokens / 1_000_000) * p.outputPerM;
  return Number(cost.toFixed(6));
}
