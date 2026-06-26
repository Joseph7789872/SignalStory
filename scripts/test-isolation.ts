/**
 * Live multi-tenant / quota / webhook-dedup tests. Requires a migrated DB:
 *   1) set DATABASE_URL/DIRECT_URL (e.g. in .env)
 *   2) npm run db:push
 *   3) npx tsx scripts/test-isolation.ts  (or: npm run test:isolation)
 *
 * Creates two throwaway orgs and deletes them (cascade) in a finally block.
 */
import { prisma } from "@/lib/db";
import {
  getUsage,
  assertWithinQuota,
  QuotaExceededError,
} from "@/lib/billing/quota";
import { PLANS } from "@/lib/billing/plans";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

const stamp = Date.now();

function makeOrg(tag: string) {
  return prisma.organization.create({
    data: {
      name: `iso-${tag}-${stamp}`,
      slug: `iso-${tag}-${stamp}`,
      subscription: { create: {} }, // defaults to FREE
    },
  });
}

const newSignal = (orgId: string, title: string, status: "QUEUED" | "REJECTED" | "FAILED" = "QUEUED") =>
  prisma.signal.create({
    data: { orgId, source: "MANUAL", rawInput: { title }, status },
  });

async function main() {
  const a = await makeOrg("a");
  const b = await makeOrg("b");

  try {
    // --- Tenant isolation ---
    console.log("\ntenant isolation:");
    await newSignal(a.id, "A-1");
    await newSignal(a.id, "A-2");
    await newSignal(b.id, "B-1");

    const aSignals = await prisma.signal.findMany({ where: { orgId: a.id } });
    check("org A query returns only A's signals", aSignals.length === 2 && aSignals.every((s) => s.orgId === a.id));
    check("no B rows leak into A's query", !aSignals.some((s) => s.orgId === b.id));

    // --- Quota gate (per-org, independent) ---
    console.log("\nquota gate:");
    const free = PLANS.FREE.monthlySignals;
    const used = await prisma.signal.count({
      where: { orgId: a.id, status: { notIn: ["REJECTED", "FAILED"] } },
    });
    for (let i = used; i < free; i++) await newSignal(a.id, `A-fill-${i}`);

    const usageA = await getUsage(a.id);
    check("A is over its signal quota", usageA.overSignalQuota === true, `used=${usageA.signalsUsed}/${usageA.signalQuota}`);

    let quotaThrew = false;
    try {
      await assertWithinQuota(a.id);
    } catch (e) {
      if (e instanceof QuotaExceededError) quotaThrew = true;
    }
    check("assertWithinQuota throws QuotaExceededError for A", quotaThrew);

    const usageB = await getUsage(b.id);
    check("B's meter is unaffected by A", usageB.overSignalQuota === false && usageB.signalsUsed === 1);

    // REJECTED/FAILED don't burn quota
    await newSignal(b.id, "B-rejected", "REJECTED");
    await newSignal(b.id, "B-failed", "FAILED");
    const usageB2 = await getUsage(b.id);
    check("REJECTED/FAILED excluded from quota count", usageB2.signalsUsed === 1);

    // --- Missing subscription → FREE fallback ---
    console.log("\nsubscription fallback:");
    await prisma.subscription.deleteMany({ where: { orgId: a.id } });
    const usageNoSub = await getUsage(a.id);
    check("missing Subscription row → FREE plan", usageNoSub.plan.id === "FREE");

    // --- Webhook dedup (per-connection) ---
    console.log("\nwebhook dedup:");
    const conn = await prisma.integrationConnection.create({
      data: { orgId: a.id, provider: "WEBHOOK", secret: "enc", webhookToken: `tok-${stamp}` },
    });
    await prisma.ingestedEvent.create({
      data: { connectionId: conn.id, provider: "WEBHOOK", externalId: "evt-1" },
    });
    let dupThrew = false;
    try {
      await prisma.ingestedEvent.create({
        data: { connectionId: conn.id, provider: "WEBHOOK", externalId: "evt-1" },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") dupThrew = true;
    }
    check("duplicate (connectionId, externalId) rejected (P2002)", dupThrew);

    const conn2 = await prisma.integrationConnection.create({
      data: { orgId: b.id, provider: "WEBHOOK", secret: "enc", webhookToken: `tok2-${stamp}` },
    });
    const ev2 = await prisma.ingestedEvent.create({
      data: { connectionId: conn2.id, provider: "WEBHOOK", externalId: "evt-1" },
    });
    check("same externalId under a different connection is allowed", Boolean(ev2.id));

    // --- Soft delete + restore ---
    console.log("\nsoft delete:");
    const sd = await newSignal(a.id, "A-to-delete");
    await prisma.signal.update({ where: { id: sd.id }, data: { deletedAt: new Date() } });
    const activeList = await prisma.signal.findMany({ where: { orgId: a.id, deletedAt: null } });
    check("soft-deleted signal excluded from default list", !activeList.some((s) => s.id === sd.id));
    const trashed = await prisma.signal.findMany({ where: { orgId: a.id, deletedAt: { not: null } } });
    check("soft-deleted signal appears in trash query", trashed.some((s) => s.id === sd.id));
    await prisma.signal.update({ where: { id: sd.id }, data: { deletedAt: null } });
    const restored = await prisma.signal.findMany({ where: { orgId: a.id, deletedAt: null } });
    check("restore brings the signal back", restored.some((s) => s.id === sd.id));

    // --- Audit log is org-scoped ---
    console.log("\naudit + social isolation:");
    await prisma.auditLog.create({ data: { orgId: a.id, action: "test.action", resourceType: "Signal" } });
    const aLogs = await prisma.auditLog.count({ where: { orgId: a.id } });
    const bLogs = await prisma.auditLog.count({ where: { orgId: b.id } });
    check("audit log row is scoped to its org", aLogs >= 1 && bLogs === 0);

    // --- SocialAccount is org-scoped ---
    await prisma.socialAccount.create({
      data: { orgId: a.id, provider: "LINKEDIN", externalId: "urn:li:person:x", accessToken: "enc" },
    });
    const bSocial = await prisma.socialAccount.findMany({ where: { orgId: b.id } });
    check("one org cannot see another's social account", bSocial.length === 0);
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await prisma.$disconnect();
  }

  console.log("");
  if (failures) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All isolation checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
