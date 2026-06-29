import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { buildContextBundle } from "@/lib/context/bundle";
import { regenerateChannel } from "@/lib/agents/channelTransformer";
import { runAntiSlopEditor } from "@/lib/agents/antiSlopEditor";
import type { AntiSlopScore, NarrativeBrief } from "@/lib/agents/schemas";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asset = await prisma.contentAsset.findFirst({
    where: { id: params.id, signal: { orgId: ctx.org.id } },
    include: { signal: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!asset.signal.narrativeBrief) {
    return NextResponse.json(
      { error: "Signal has no narrative brief to regenerate from" },
      { status: 409 },
    );
  }

  const context = await buildContextBundle(ctx.org.id);
  const brief = asset.signal.narrativeBrief as unknown as NarrativeBrief;
  const prior = asset.antiSlopDetail as unknown as AntiSlopScore | null;
  const guidance =
    prior?.regenerateGuidance ??
    "Make it more specific and grounded in the company context; cut anything a generic model could have written.";

  const fixed = await regenerateChannel({
    signalId: asset.signalId,
    context,
    brief,
    channel: asset.channel,
    guidance,
  });

  const verdict = await runAntiSlopEditor({
    signalId: asset.signalId,
    context,
    brief,
    channel: asset.channel,
    assetBody: fixed,
  });

  const updated = await prisma.contentAsset.update({
    where: { id: asset.id },
    data: {
      body: fixed as object,
      antiSlopScore: verdict.score,
      antiSlopDetail: verdict as unknown as object,
      regenCount: { increment: 1 },
      reviewStatus: verdict.passes ? "PENDING" : "NEEDS_WORK",
      editedBody: undefined,
    },
  });

  await prisma.feedback.create({
    data: {
      signalId: asset.signalId,
      assetId: asset.id,
      userId: ctx.user.id,
      decision: "REGENERATE",
    },
  });

  return NextResponse.json({ asset: updated });
}
