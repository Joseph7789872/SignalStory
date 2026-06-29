import { prisma } from "@/lib/db";
import { embedOne, toVectorLiteral } from "@/lib/agents/embeddings";

export type ProofSource = {
  id: string; // stable citation id within this retrieval, e.g. "S1"
  chunkId: string;
  docId: string;
  title: string;
  sourceUrl: string | null;
  kind: string;
  excerpt: string; // truncated text shown in the proof block + UI
  score: number; // cosine similarity (1 = identical)
};

export type RetrievedProof = {
  block: string; // citation-tagged text passed to agents (empty if no store)
  sources: ProofSource[]; // resolved sources for the proof-library UI + audit
  tokens: number; // embedding tokens used (for cost accounting)
};

type Row = {
  chunkId: string;
  docId: string;
  text: string;
  title: string;
  sourceUrl: string | null;
  kind: string;
  score: number;
};

const EXCERPT_CHARS = 500;

/**
 * Embed `query`, then fetch the org's most similar memory chunks via pgvector
 * cosine distance (`<=>`). Returns a deterministic, citation-tagged proof block
 * the agents must cite from, plus the resolved sources. Degrades gracefully:
 * an empty store (or any retrieval error) yields an empty block so the pipeline
 * behaves exactly as it did pre-V5.
 */
export async function retrieveProof(
  orgId: string,
  query: string,
  k = 6,
): Promise<RetrievedProof> {
  const trimmed = query.trim();
  if (!trimmed) return { block: "", sources: [], tokens: 0 };

  let tokens = 0;
  let rows: Row[] = [];
  try {
    const { vector, tokens: t } = await embedOne(trimmed);
    tokens = t;
    if (vector.length === 0) return { block: "", sources: [], tokens };
    const lit = toVectorLiteral(vector);
    rows = await prisma.$queryRaw<Row[]>`
      SELECT c.id AS "chunkId",
             c."docId" AS "docId",
             c.text AS text,
             d.title AS title,
             d."sourceUrl" AS "sourceUrl",
             d.kind::text AS kind,
             (1 - (c.embedding <=> ${lit}::vector)) AS score
      FROM "MemoryChunk" c
      JOIN "MemoryDoc" d ON d.id = c."docId"
      WHERE c."orgId" = ${orgId} AND c.embedding IS NOT NULL AND d."deletedAt" IS NULL
      ORDER BY c.embedding <=> ${lit}::vector ASC
      LIMIT ${k}
    `;
  } catch {
    // pgvector/DB unavailable → no proof, pipeline still runs.
    return { block: "", sources: [], tokens };
  }

  const sources: ProofSource[] = rows.map((r, i) => ({
    id: `S${i + 1}`,
    chunkId: r.chunkId,
    docId: r.docId,
    title: r.title,
    sourceUrl: r.sourceUrl,
    kind: r.kind,
    excerpt: r.text.slice(0, EXCERPT_CHARS),
    score: Number(r.score),
  }));

  return { block: formatProofBlock(sources), sources, tokens };
}

/** Deterministic, model-facing proof block. Empty string when there are none. */
export function formatProofBlock(sources: ProofSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map(
    (s) =>
      `[${s.id}] (${s.kind.toLowerCase()} — "${s.title}"): ${s.excerpt}`,
  );
  return [
    "RETRIEVED PROOF — excerpts from this company's own knowledge & founder memory.",
    "Cite these by id (e.g. [S1]) for any claim they support. Never invent a citation;",
    "if no excerpt supports a claim, mark that claim unsupported.",
    "",
    ...lines,
  ].join("\n");
}
