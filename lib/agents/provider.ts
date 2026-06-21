import type { Tier } from "./models";
import { resolveProvider } from "./models";

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export type CompleteArgs = {
  tier: Tier;
  /** Stable shared prefix (the context bundle) — cached where the provider supports it. */
  cachedContext: string;
  /** Per-agent role + rubric. */
  instruction: string;
  /** Volatile per-signal input. */
  input: string;
  /** JSON Schema describing the required output object. */
  schema: Record<string, unknown>;
  maxTokens: number;
};

export type CompleteResult = {
  /** Raw text containing the JSON object (caller extracts + validates). */
  text: string;
  model: string;
  usage: LLMUsage;
};

export interface LLMProvider {
  readonly name: "anthropic" | "openai";
  complete(args: CompleteArgs): Promise<CompleteResult>;
}

let _provider: LLMProvider | null = null;

/** Returns the active provider adapter (memoized per process). */
export async function getProvider(): Promise<LLMProvider> {
  if (_provider) return _provider;
  const name = resolveProvider();
  if (name === "openai") {
    const { OpenAIProvider } = await import("./providers/openai");
    _provider = new OpenAIProvider();
  } else {
    const { AnthropicProvider } = await import("./providers/anthropic");
    _provider = new AnthropicProvider();
  }
  return _provider;
}
