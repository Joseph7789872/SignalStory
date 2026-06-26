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
      where: { signal: { orgId }, createdAt: { gte: periodStart } },
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
