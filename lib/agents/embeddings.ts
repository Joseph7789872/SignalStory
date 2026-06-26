import OpenAI from "openai";

// V5 memory store embeddings. NOTE: Anthropic has no first-party embeddings API,
// so embeddings always use OpenAI regardless of LLM_PROVIDER — V5 requires
// OPENAI_API_KEY even on the Anthropic path. The model is env-overridable.
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536; // text-embedding-3-small; matches vector(1536)

// ~$0.02 / 1M tokens for text-embedding-3-small (in-app cost estimate only).
const EMBEDDING_PRICE_PER_M = 0.02;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

export type EmbedResult = { vectors: number[][]; tokens: number };

/** Embed one or more texts. Returns row-aligned vectors + total token usage. */
export async function embed(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], tokens: 0 };
  const resp = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  // The API preserves input order in resp.data.
  const vectors = resp.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
  return { vectors, tokens: resp.usage?.total_tokens ?? 0 };
}

/** Convenience for a single query embedding. */
export async function embedOne(text: string): Promise<{ vector: number[]; tokens: number }> {
  const { vectors, tokens } = await embed([text]);
  return { vector: vectors[0] ?? [], tokens };
}

export function estimateEmbeddingCostUsd(tokens: number): number {
  return Number(((tokens / 1_000_000) * EMBEDDING_PRICE_PER_M).toFixed(6));
}

/** Postgres vector literal: pgvector accepts a string like "[0.1,0.2,...]". */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
