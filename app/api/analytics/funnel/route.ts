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

  // Assets (exclude soft-deleted) within range, with the fields the funnel needs.
  const assets = await prisma.contentAsset.findMany({
    where: {
      signal: { orgId },
      deletedAt: null,
      ...(createdRange ? { createdAt: createdRange } : {}),
    },
    select: { id: true, channel: true, reviewStatus: true, antiSlopScore: true, createdAt: true },
  });

  const scheduled = await prisma.scheduledPost.findMany({
    where: {
      orgId,
      ...(createdRange ? { createdAt: createdRange } : {}),
    },
    select: { channel: true, status: true },
  });

  const isApproved = (s: string) => s === "APPROVED" || s === "EDITED";
  const generated = assets.length;
  const reviewed = assets.filter((a) => a.reviewStatus !== "PENDING").length;
  const approved = assets.filter((a) => isApproved(a.reviewStatus)).length;
  const scheduledCount = scheduled.length;
  const posted = scheduled.filter((s) => s.status === "POSTED").length;

  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

  // Per-channel funnel.
  const byChannel = CHANNELS.map((ch) => {
    const a = assets.filter((x) => x.channel === ch);
    const sp = scheduled.filter((x) => x.channel === ch);
    return {
      channel: ch,
      generated: a.length,
      approved: a.filter((x) => isApproved(x.reviewStatus)).length,
      scheduled: sp.length,
      posted: sp.filter((x) => x.status === "POSTED").length,
    };
  });

  // Anti-slop quality trend (avg per bucket) over scored assets.
  const scored = assets.filter((a) => a.antiSlopScore != null);
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
