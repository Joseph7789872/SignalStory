import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Org-scoped cost/quality aggregates for the dashboard. All numbers come from
 * AgentRun (cost/tokens/cache), Signal (status + gate), ContentAsset
 * (anti-slop + review), and Feedback.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = ctx.org.id;
  const signalWhere = { signal: { orgId } };

  const [
    signals,
    statusGroups,
    runByAgent,
    runTotals,
    assetGroups,
    assetSlop,
    feedbackGroups,
  ] = await Promise.all([
    prisma.signal.count({ where: { orgId } }),
    prisma.signal.groupBy({
      by: ["status"],
      where: { orgId },
      _count: true,
    }),
    prisma.agentRun.groupBy({
      by: ["agent"],
      where: signalWhere,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),
    prisma.agentRun.aggregate({
      where: signalWhere,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),
    prisma.contentAsset.groupBy({
      by: ["reviewStatus"],
      where: signalWhere,
      _count: true,
    }),
    prisma.contentAsset.aggregate({
      where: signalWhere,
      _avg: { antiSlopScore: true },
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ["decision"],
      where: signalWhere,
      _count: true,
    }),
  ]);

  const totalCost = runTotals._sum.costUsd ?? 0;
  const totalInput = runTotals._sum.inputTokens ?? 0;
  const totalCached = runTotals._sum.cacheReadTokens ?? 0;
  const rejected =
    statusGroups.find((s) => s.status === "REJECTED")?._count ?? 0;
  const slopPassCount =
    assetGroups
      .filter((a) => a.reviewStatus !== "NEEDS_WORK")
      .reduce((n, a) => n + a._count, 0) ?? 0;
  const totalAssets = assetSlop._count._all ?? 0;

  return NextResponse.json({
    totals: {
      signals,
      totalCostUsd: totalCost,
      costPerSignal: signals ? totalCost / signals : 0,
      llmCalls: runTotals._count,
      cacheHitPct: totalInput ? (totalCached / totalInput) * 100 : 0,
      gateRejectionPct: signals ? (rejected / signals) * 100 : 0,
      avgAntiSlop: assetSlop._avg.antiSlopScore ?? 0,
      antiSlopPassPct: totalAssets ? (slopPassCount / totalAssets) * 100 : 0,
    },
    byAgent: runByAgent
      .map((r) => ({
        agent: r.agent,
        costUsd: r._sum.costUsd ?? 0,
        calls: r._count,
        inputTokens: r._sum.inputTokens ?? 0,
        outputTokens: r._sum.outputTokens ?? 0,
        cacheReadTokens: r._sum.cacheReadTokens ?? 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    signalStatus: statusGroups.map((s) => ({
      status: s.status,
      count: s._count,
    })),
    assetReview: assetGroups.map((a) => ({
      status: a.reviewStatus,
      count: a._count,
    })),
    feedback: feedbackGroups.map((f) => ({
      decision: f.decision,
      count: f._count,
    })),
  });
}
