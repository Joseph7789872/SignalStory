import { prisma } from "@/lib/db";
import { getPlan, type Plan } from "@/lib/billing/plans";

// Per-org usage meter. Reuses the AgentRun aggregate pattern from
// app/api/analytics/route.ts and the Signal count pattern. A missing
// Subscription row is treated as FREE so pre-billing orgs still get a cap.

export type Usage = {
  plan: Plan;
  periodStart: Date;
  periodEnd: Date | null;
  signalsUsed: number;
  signalQuota: number;
  spendUsd: number;
  hardSpendCapUsd: number;
  overSignalQuota: boolean;
  overSpendCap: boolean;
};

/** UTC start-of-month — the billing anchor for FREE (no Stripe period). */
function startOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getUsage(orgId: string): Promise<Usage> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const plan = getPlan(sub?.plan);

  // Paid plans meter on the Stripe billing period; FREE/missing on calendar month.
  const onStripePeriod = plan.id !== "FREE" && sub?.currentPeriodStart;
  const periodStart = onStripePeriod ? sub!.currentPeriodStart : startOfMonthUtc();
  const periodEnd = onStripePeriod ? sub!.currentPeriodEnd : null;

  const [signalsUsed, spendAgg] = await Promise.all([
    // Exclude REJECTED/FAILED so rejected noise + failures don't burn quota.
    prisma.signal.count({
      where: {
        orgId,
        createdAt: { gte: periodStart },
        status: { notIn: ["REJECTED", "FAILED"] },
      },
    }),
    prisma.agentRun.aggregate({
      _sum: { costUsd: true },
      // Sum runs attributed to one of the org's signals OR directly to the org
      // (signal-less runs like document-ingestion embeddings carry orgId).
      where: {
        createdAt: { gte: periodStart },
        OR: [{ signal: { orgId } }, { orgId }],
      },
    }),
  ]);
  const spendUsd = spendAgg._sum.costUsd ?? 0;

  return {
    plan,
    periodStart,
    periodEnd,
    signalsUsed,
    signalQuota: plan.monthlySignals,
    spendUsd,
    hardSpendCapUsd: plan.hardSpendCapUsd,
    overSignalQuota: signalsUsed >= plan.monthlySignals,
    overSpendCap: spendUsd >= plan.hardSpendCapUsd,
  };
}

/** Thrown by assertWithinQuota; carries the usage snapshot for the 402 body. */
export class QuotaExceededError extends Error {
  usage: Usage;
  constructor(usage: Usage) {
    super("QUOTA_EXCEEDED");
    this.name = "QuotaExceededError";
    this.usage = usage;
  }
}

/** Hard block: throws QuotaExceededError if the org is over signals or spend. */
export async function assertWithinQuota(orgId: string): Promise<void> {
  const usage = await getUsage(orgId);
  if (usage.overSignalQuota || usage.overSpendCap) {
    throw new QuotaExceededError(usage);
  }
}

/** Defense-in-depth check used by the pipeline before burning more LLM spend. */
export async function isOverSpendCap(orgId: string): Promise<boolean> {
  return (await getUsage(orgId)).overSpendCap;
}

// A reservation is valid for at most this long; a pipeline run that exceeds it
// (crash/stuck) stops counting against the cap so the org isn't blocked forever.
const RESERVATION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Atomically reserve `estimateUsd` against the org's hard spend cap. Uses a
 * per-org Postgres advisory lock so concurrent runs serialize their
 * check-and-reserve: committed spend + outstanding reservations + this estimate
 * must stay within the cap, otherwise the reservation is refused. This closes
 * the TOCTOU window where N concurrent signals each read "under cap" and
 * collectively overshoot. Returns true if reserved (caller may proceed).
 */
export async function reserveSpend(
  orgId: string,
  signalId: string,
  estimateUsd: number,
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const plan = getPlan(sub?.plan);
  const onStripePeriod = plan.id !== "FREE" && sub?.currentPeriodStart;
  const periodStart = onStripePeriod ? sub!.currentPeriodStart : startOfMonthUtc();
  const cap = plan.hardSpendCapUsd;
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    // Serialize concurrent reservations for this org.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
    // Drop this org's expired holds so they don't block forever.
    await tx.spendReservation.deleteMany({
      where: { orgId, createdAt: { lt: cutoff } },
    });
    const spendAgg = await tx.agentRun.aggregate({
      _sum: { costUsd: true },
      where: { signal: { orgId }, createdAt: { gte: periodStart } },
    });
    const resAgg = await tx.spendReservation.aggregate({
      _sum: { amountUsd: true },
      where: { orgId, createdAt: { gte: cutoff } },
    });
    const projected =
      (spendAgg._sum.costUsd ?? 0) + (resAgg._sum.amountUsd ?? 0);
    if (projected + estimateUsd > cap) return false;
    await tx.spendReservation.create({
      data: { orgId, signalId, amountUsd: estimateUsd },
    });
    return true;
  });
}

/** Release a run's reservation once its real cost has settled (success path). */
export async function releaseSpend(signalId: string): Promise<void> {
  await prisma.spendReservation.deleteMany({ where: { signalId } });
}
