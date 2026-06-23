// Deterministic text chunker for the V5 memory store. Pure + side-effect free
// (unit-testable offline). Splits on paragraph/heading boundaries, packs into
// ~maxChars windows with a small overlap so a claim that straddles a boundary
// still lands whole in at least one chunk.

export type ChunkOptions = {
  maxChars?: number; // soft cap per chunk (~800 tokens ≈ 3200 chars)
  overlapChars?: number; // carry-over from the previous chunk
  minChars?: number; // drop trailing scraps shorter than this (unless it's the only chunk)
};

const DEFAULTS = { maxChars: 3200, overlapChars: 320, minChars: 60 };

/** Normalize whitespace without collapsing paragraph breaks. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split into paragraph-ish blocks (blank-line separated), keeping order. */
function blocks(text: string): string[] {
  return normalize(text)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const { maxChars, overlapChars, minChars } = { ...DEFAULTS, ...opts };
  const parts = blocks(text);
  if (parts.length === 0) return [];

  const chunks: string[] = [];
  let cur = "";

  const push = () => {
    const trimmed = cur.trim();
    if (trimmed) chunks.push(trimmed);
    cur = "";
  };

  for (const part of parts) {
    // A single oversized block: hard-split it into maxChars slices.
    if (part.length > maxChars) {
      push();
      for (let i = 0; i < part.length; i += maxChars) {
        chunks.push(part.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if (cur && cur.length + part.length + 2 > maxChars) {
      const prev = cur;
      push();
      // Overlap: seed the next chunk with the tail of the previous one.
      if (overlapChars > 0) cur = prev.slice(-overlapChars).trim() + "\n\n";
    }
    cur += (cur ? "\n\n" : "") + part;
  }
  push();

  // Drop tiny trailing scraps unless they're all we have.
  const filtered = chunks.filter((c) => c.length >= minChars);
  return filtered.length ? filtered : chunks.slice(0, 1);
}
