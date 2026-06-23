/**
 * LIVE smoke test for the V5 memory store: embed two distinct docs, then confirm
 * pgvector retrieval ranks the topically-relevant one first. Needs DB + OPENAI_API_KEY.
 *   npx tsx scripts/test-knowledge.ts
 */
import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import { chunkText } from "@/lib/knowledge/chunk";
import { retrieveProof } from "@/lib/knowledge/retrieve";
import { embed, toVectorLiteral } from "@/lib/agents/embeddings";

const ORG_SLUG = "ingest-test-org";
let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ok" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function addDoc(orgId: string, title: string, kind: string, text: string) {
  const doc = await prisma.memoryDoc.create({
    data: { orgId, title, kind: kind as never, rawText: text },
  });
  const chunks = chunkText(text);
  const { vectors } = await embed(chunks);
  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "MemoryChunk" (id, "docId", "orgId", ord, text, embedding, "createdAt")
      VALUES (${randomUUID()}, ${doc.id}, ${orgId}, ${i}, ${chunks[i]}, ${toVectorLiteral(vectors[i])}::vector, now())
    `;
  }
  return doc.id;
}

async function main() {
  const org =
    (await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })) ??
    (await prisma.organization.create({
      data: {
        name: "Ingest Test Co",
        slug: ORG_SLUG,
        profile: { create: { description: "Test org." } },
        founder: { create: {} },
        brandVoice: { create: {} },
        editorial: { create: {} },
      },
    }));

  // Clean prior memory for a deterministic assertion.
  await prisma.memoryDoc.deleteMany({ where: { orgId: org.id } });

  console.log("\n=== Seeding memory ===");
  const governanceId = await addDoc(
    org.id,
    "Enterprise governance case study",
    "CASE_STUDY",
    "When we sold to regulated enterprises, buyers cared most about governance: audit logs, " +
      "access controls, data residency, and SSO. The security review — not the model quality — " +
      "was the real sales cycle. We cut the enterprise procurement timeline 40% by shipping an " +
      "audit-log export and a SOC2 report up front. Governance evidence closed the deal.",
  );
  await addDoc(
    org.id,
    "Team offsite recap",
    "OTHER",
    "Our quarterly team offsite was in Vermont. We went hiking, did a cooking class, and played " +
      "board games late into the night. Morale was high and the weather was perfect. A great time.",
  );
  console.log("  seeded 2 docs");

  console.log("\n=== Retrieval ===");
  const r = await retrieveProof(
    org.id,
    "What do enterprise buyers care about for AI security, audit logs, and procurement?",
  );
  check("retrieval returns sources", r.sources.length > 0, `${r.sources.length} sources`);
  check(
    "top source is the governance doc (not the offsite)",
    r.sources[0]?.docId === governanceId,
    r.sources[0]?.title,
  );
  check("proof block is citation-tagged", r.block.includes("[S1]"));
  check("embedding tokens were counted", r.tokens > 0);

  // Cleanup.
  await prisma.memoryDoc.deleteMany({ where: { orgId: org.id } });

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
