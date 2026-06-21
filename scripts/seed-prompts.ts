/**
 * Seeds the PromptTemplate table with each agent's current in-code instruction
 * as the active version. Idempotent: skips agents that already have rows.
 *   npx tsx scripts/seed-prompts.ts
 */
import { prisma } from "@/lib/db";
import { AGENT_DEFAULTS } from "@/lib/agents/registry";

async function main() {
  for (const d of AGENT_DEFAULTS) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { agent: d.agent },
    });
    if (existing) {
      console.log(`skip ${d.agent} (already seeded)`);
      continue;
    }
    await prisma.promptTemplate.create({
      data: {
        agent: d.agent,
        version: d.version,
        instruction: d.instruction,
        isActive: true,
      },
    });
    console.log(`seeded ${d.agent} @ ${d.version}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
