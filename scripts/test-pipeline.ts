/**
 * Live end-to-end verification. Requires a migrated DB + an LLM key:
 *   1) set DATABASE_URL/DIRECT_URL and an LLM key (e.g. in .env)
 *   2) npm run db:push
 *   3) npx tsx scripts/test-pipeline.ts
 *
 * Verifies: strong signal -> READY with 3 reviewed assets; weak signal -> the
 * significance gate (REJECTED); per-agent cost recorded; prompt-cache reuse on
 * later same-tier reasoning agents.
 *
 * Prompt caching is provider-specific: Anthropic caching is explicit and
 * deterministic (hard-checked); OpenAI caching is automatic and only engages
 * for prompt prefixes >=1024 tokens, so on OpenAI it's reported informationally.
 */
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import { resolveProvider } from "@/lib/agents/models";

const SLUG = "e2e-test-org";

async function ensureOrg() {
  const existing = await prisma.organization.findUnique({
    where: { slug: SLUG },
    include: { users: true },
  });
  if (existing) return existing;

  return prisma.organization.create({
    data: {
      name: "E2E Test Co",
      slug: SLUG,
      profile: {
        create: {
          description:
            "We build governance tooling for AI agents used inside regulated enterprises.",
          category: "AI governance",
          icp: "Heads of platform/security at regulated enterprises adopting AI agents",
        },
      },
      founder: {
        create: {
          name: "Test Founder",
          beliefs: [
            "Most enterprise AI adoption stalls on governance, not capability.",
            "Buyers trust proof and specifics far more than vision.",
          ],
          frameworks: [
            {
              name: "Context beats prompts",
              summary: "Grounding in proprietary context outperforms clever prompting.",
            },
          ],
          lessons: ["Security review is the real sales cycle, not the demo."],
          writingSamples: [
            {
              label: "voice",
              text: "Short sentences. Concrete numbers. No hype. We say what we learned, not what we hope.",
            },
          ],
        },
      },
      brandVoice: {
        create: {
          tone: "Direct, specific, no hype",
          sentenceStyle: "Short, declarative",
          bannedPhrases: ["game-changer", "in today's fast-paced world", "unlock"],
          vocabulary: { prefer: ["governance", "proof"], avoid: ["synergy"] },
          opinionatedness: "High",
          technicalDepth: "Medium-high",
        },
      },
      editorial: {
        create: {
          pillars: [
            { name: "Enterprise AI governance", description: "Why governance gates adoption" },
          ],
          audiences: [
            { name: "Platform/security leaders", description: "Own AI rollout risk" },
          ],
          goals: ["Build trust", "Category creation"],
          topicsToAvoid: ["Generic AI hype"],
        },
      },
      users: {
        create: {
          authUserId: "e2e-test-auth-id",
          email: "e2e@test.local",
          name: "Test Founder",
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });
}

async function runOne(orgId: string, userId: string, rawInput: object) {
  const signal = await prisma.signal.create({
    data: { orgId, userId, source: "MANUAL", rawInput, status: "QUEUED" },
  });
  await runPipeline(signal.id);
  return prisma.signal.findUniqueOrThrow({
    where: { id: signal.id },
    include: { assets: true, runs: true },
  });
}

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ok" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function main() {
  const org = await ensureOrg();
  const userId = org.users[0].id;

  console.log("\n=== Strong signal ===");
  const strong = await runOne(org.id, userId, {
    title: "Signed our first regulated-enterprise customer",
    description:
      "A top-10 bank signed after a 6-week security review. Their AI features were not the blocker — governance, audit logging, and role-based controls were. Procurement spent more time on our audit trail than on model quality.",
    evidence:
      "6-week security review; 0 questions about model accuracy; 14 questions about audit logging and access control; contract value mid-six-figures.",
    links: [],
  });
  console.log(`status=${strong.status} score=${strong.significanceScore} cost=$${strong.costUsd.toFixed(4)}`);
  check("strong signal reached READY", strong.status === "READY", strong.statusReason ?? "");
  check("produced 3 assets", strong.assets.length === 3);
  check(
    "every asset has an anti-slop score",
    strong.assets.every((a) => a.antiSlopScore != null),
  );
  const reasoningRuns = strong.runs.filter((r) =>
    ["significance_scorer", "story_finder", "narrative_strategist", "anti_slop_editor"].includes(
      r.agent,
    ),
  );
  const cacheSummary = reasoningRuns
    .map((r) => `${r.agent}=${r.cacheReadTokens}`)
    .join(", ");
  if (resolveProvider() === "anthropic") {
    check(
      "prompt cache reused on a later reasoning agent",
      reasoningRuns.some((r) => r.cacheReadTokens > 0),
      `cacheRead per reasoning agent: ${cacheSummary}`,
    );
  } else {
    // OpenAI auto-caches only prefixes >=1024 tokens; informational, not a gate.
    const reused = reasoningRuns.some((r) => r.cacheReadTokens > 0);
    console.log(
      `  info  prompt cache (OpenAI, auto, best-effort): ${reused ? "engaged" : "not engaged"} — ${cacheSummary}`,
    );
  }

  console.log("\n=== Weak signal (gate) ===");
  const weak = await runOne(org.id, userId, {
    title: "We had a team lunch",
    description: "The team went to lunch today. It was nice. Good vibes.",
    evidence: "",
    links: [],
  });
  console.log(`status=${weak.status} score=${weak.significanceScore} reason=${weak.statusReason ?? ""}`);
  check(
    "weak signal stopped at the gate (REJECTED)",
    weak.status === "REJECTED",
    `got ${weak.status}`,
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
