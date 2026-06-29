import { NextResponse } from "next/server";
import type { Channel } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { bucketSeries, type Bucket } from "@/lib/analytics/buckets";

export const dynamic = "force-dynamic";

const CHANNELS: Channel[] = ["LINKEDIN_FOUNDER", "X_THREAD", "BLOG_POST"];

// Content funnel + quality trend for the org, within an optional date range.
// generated → reviewed → approved → scheduled → posted (+ per-channel + anti-slop trend).
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = ctx.org.id;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const bucket = (url.searchParams.get("bucket") as Bucket) || "week";
  const createdRange =
    from || to
      ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
      : undefined;

  // Funnel counts are computed DB-side (groupBy) rather than by materializing
  // every asset/scheduled-post row in the request — these tables grow with org
  // age and the previous unbounded findMany could OOM/timeout active orgs.
  const isApproved = (s: string) => s === "APPROVED" || s === "EDITED";

  const [assetGroups, scheduledGroups] = await Promise.all([
    prisma.contentAsset.groupBy({
      by: ["channel", "reviewStatus"],
      where: {
        signal: { orgId },
        deletedAt: null,
        ...(createdRange ? { createdAt: createdRange } : {}),
      },
      _count: { _all: true },
    }),
    prisma.scheduledPost.groupBy({
      by: ["channel", "status"],
      where: { orgId, ...(createdRange ? { createdAt: createdRange } : {}) },
      _count: { _all: true },
    }),
  ]);

  const sumCount = <T extends { _count: { _all: number } }>(
    rows: T[],
    pred: (r: T) => boolean,
  ) => rows.reduce((n, r) => (pred(r) ? n + r._count._all : n), 0);

  const generated = sumCount(assetGroups, () => true);
  const reviewed = sumCount(assetGroups, (g) => g.reviewStatus !== "PENDING");
  const approved = sumCount(assetGroups, (g) => isApproved(g.reviewStatus));
  const scheduledCount = sumCount(scheduledGroups, () => true);
  const posted = sumCount(scheduledGroups, (g) => g.status === "POSTED");

  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

  // Per-channel funnel.
  const byChannel = CHANNELS.map((ch) => ({
    channel: ch,
    generated: sumCount(assetGroups, (g) => g.channel === ch),
    approved: sumCount(
      assetGroups,
      (g) => g.channel === ch && isApproved(g.reviewStatus),
    ),
    scheduled: sumCount(scheduledGroups, (g) => g.channel === ch),
    posted: sumCount(
      scheduledGroups,
      (g) => g.channel === ch && g.status === "POSTED",
    ),
  }));

  // Anti-slop quality trend (avg per bucket) over scored assets. Bounded to the
  // most recent 5000 scored assets so a large org can't load an unbounded set.
  const scored = await prisma.contentAsset.findMany({
    where: {
      signal: { orgId },
      deletedAt: null,
      antiSlopScore: { not: null },
      ...(createdRange ? { createdAt: createdRange } : {}),
    },
    select: { antiSlopScore: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const trend = bucketSeries(scored, (a) => a.createdAt, bucket).map((b) => ({
    key: b.key,
    avgAntiSlop:
      b.rows.reduce((s, a) => s + (a.antiSlopScore ?? 0), 0) / b.rows.length,
    count: b.rows.length,
  }));

  return NextResponse.json({
    funnel: { generated, reviewed, approved, scheduled: scheduledCount, posted },
    rates: {
      approvalRate: pct(approved, generated),
      scheduleRate: pct(scheduledCount, approved),
      postRate: pct(posted, scheduledCount),
    },
    byChannel,
    qualityTrend: trend,
    bucket,
  });
}
