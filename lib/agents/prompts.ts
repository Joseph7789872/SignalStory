import { prisma } from "@/lib/db";

export type ResolvedPrompt = { version: string; instruction: string };

// Short-lived per-process cache so a pipeline run doesn't re-query for every
// agent, while a newly-activated version is still picked up within seconds.
const TTL_MS = 15_000;
const cache = new Map<string, { value: ResolvedPrompt; expires: number }>();

/**
 * Returns the active PromptTemplate for an agent, scoped to the signal's org.
 * Org-specific versions win; orgId=null rows are deployment defaults only.
 */
export async function getActivePrompt(
  agent: string,
  fallback: ResolvedPrompt,
  signalId?: string,
): Promise<ResolvedPrompt> {
  let orgId: string | null = null;
  if (signalId) {
    try {
      const signal = await prisma.signal.findUnique({
        where: { id: signalId },
        select: { orgId: true },
      });
      orgId = signal?.orgId ?? null;
    } catch {
      orgId = null;
    }
  }

  const cacheKey = `${orgId ?? "global"}:${agent}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value = fallback;
  try {
    const orgRow = orgId
      ? await prisma.promptTemplate.findFirst({
          where: { orgId, agent, isActive: true },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const globalRow = orgRow
      ? null
      : await prisma.promptTemplate.findFirst({
          where: { orgId: null, agent, isActive: true },
          orderBy: { createdAt: "desc" },
        });
    const row = orgRow ?? globalRow;
    if (row) value = { version: row.version, instruction: row.instruction };
  } catch {
    // DB unavailable (e.g. offline schema test) - use the in-code default.
  }

  cache.set(cacheKey, { value, expires: Date.now() + TTL_MS });
  return value;
}