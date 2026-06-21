import { prisma } from "@/lib/db";

export type ResolvedPrompt = { version: string; instruction: string };

// Short-lived per-process cache so a pipeline run doesn't re-query for every
// agent, while a newly-activated version is still picked up within seconds.
const TTL_MS = 15_000;
const cache = new Map<string, { value: ResolvedPrompt; expires: number }>();

/**
 * Returns the active PromptTemplate for an agent, falling back to the in-code
 * default when none is set (or the DB is unavailable). The returned `version`
 * is recorded on AgentRun, so per-version performance can be measured.
 */
export async function getActivePrompt(
  agent: string,
  fallback: ResolvedPrompt,
): Promise<ResolvedPrompt> {
  const hit = cache.get(agent);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value = fallback;
  try {
    const row = await prisma.promptTemplate.findFirst({
      where: { agent, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (row) value = { version: row.version, instruction: row.instruction };
  } catch {
    // DB unavailable (e.g. offline schema test) — use the in-code default.
  }

  cache.set(agent, { value, expires: Date.now() + TTL_MS });
  return value;
}
