import { Channel, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildContextBundle } from "@/lib/context/bundle";
import { runEventListener } from "@/lib/agents/eventListener";
import { runSignificanceScorer } from "@/lib/agents/significanceScorer";
import { runStoryFinder } from "@/lib/agents/storyFinder";
import { runNarrativeStrategist } from "@/lib/agents/narrativeStrategist";
import {
  runChannelTransformer,
  regenerateChannel,
} from "@/lib/agents/channelTransformer";
import { runAntiSlopEditor } from "@/lib/agents/antiSlopEditor";
import type {
  ChannelBundle,
  EvidencePacket,
  NarrativeBrief,
  SignalScore,
} from "@/lib/agents/schemas";

const MAX_COST = Number(process.env.PIPELINE_MAX_COST_USD ?? "2.00");

const CHANNELS: { channel: Channel; key: keyof ChannelBundle }[] = [
  { channel: Channel.LINKEDIN_FOUNDER, key: "linkedinFounder" },
  { channel: Channel.X_THREAD, key: "xThread" },
  { channel: Channel.BLOG_POST, key: "blogPost" },
];

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

/** Sum AgentRun costs, persist on Signal, throw if over the per-run budget. */
async function settleCost(signalId: string): Promise<void> {
  const agg = await prisma.agentRun.aggregate({
    where: { signalId },
    _sum: { costUsd: true },
  });
  const total = agg._sum.costUsd ?? 0;
  await prisma.signal.update({
    where: { id: signalId },
    data: { costUsd: total },
  });
  if (total > MAX_COST) {
    throw new Error(
      `Cost guardrail exceeded: $${total.toFixed(4)} > $${MAX_COST.toFixed(2)}`,
    );
  }
}

/**
 * Runs the 6-agent pipeline. Each step persists its output and advances
 * Signal.status before the next step, so a future durable queue can retry a
 * single step (resumable-from-status). Fire-and-forget in V1.
 */
export async function runPipeline(signalId: string): Promise<void> {
  try {
    const signal = await prisma.signal.findUniqueOrThrow({
      where: { id: signalId },
    });
    const context = await buildContextBundle(signal.orgId);

    // [1] Event Listener / Normalizer
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "NORMALIZING" },
    });
    const evidence: EvidencePacket = await runEventListener({
      signalId,
      context,
      rawInput: signal.rawInput,
    });
    await prisma.signal.update({
      where: { id: signalId },
      data: { evidencePacket: asJson(evidence) },
    });
    await settleCost(signalId);

    // [2] Significance Scorer — the gate
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "SCORING" },
    });
    const score: SignalScore = await runSignificanceScorer({
      signalId,
      context,
      evidence,
    });
    await prisma.signal.update({
      where: { id: signalId },
      data: {
        significanceScore: score.overall,
        scoreDetail: asJson(score),
      },
    });
    await settleCost(signalId);

    if (score.recommendation === "SKIP") {
      await prisma.signal.update({
        where: { id: signalId },
        data: {
          status: "REJECTED",
          statusReason:
            "Not worth publishing yet. " +
            (score.missingInfo.length
              ? `Add: ${score.missingInfo.join("; ")}`
              : score.reasons.join("; ")),
        },
      });
      return;
    }

    // [3] Story Finder
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "STORY" },
    });
    const angles = await runStoryFinder({ signalId, context, evidence, score });
    await prisma.signal.update({
      where: { id: signalId },
      data: { storyAngles: asJson(angles) },
    });
    await settleCost(signalId);

    // [4] Narrative Strategist
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "NARRATIVE" },
    });
    const brief: NarrativeBrief = await runNarrativeStrategist({
      signalId,
      context,
      evidence,
      angles,
    });
    await prisma.signal.update({
      where: { id: signalId },
      data: { narrativeBrief: asJson(brief) },
    });
    await settleCost(signalId);

    // [5] Channel Transformer
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "CHANNEL" },
    });
    const bundle = await runChannelTransformer({ signalId, context, brief });
    for (const { channel, key } of CHANNELS) {
      await prisma.contentAsset.upsert({
        where: { signalId_channel: { signalId, channel } },
        create: { signalId, channel, body: asJson(bundle[key]) },
        update: { body: asJson(bundle[key]), reviewStatus: "PENDING" },
      });
    }
    await settleCost(signalId);

    // [6] Anti-Slop Editor (per asset, one bounded regenerate)
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "EDITING" },
    });
    for (const { channel, key } of CHANNELS) {
      const asset = await prisma.contentAsset.findUniqueOrThrow({
        where: { signalId_channel: { signalId, channel } },
      });

      let verdict = await runAntiSlopEditor({
        signalId,
        context,
        brief,
        channel,
        assetBody: asset.body,
      });
      let body: unknown = asset.body;
      let regenerated = false;

      if (!verdict.passes) {
        const fixed = await regenerateChannel({
          signalId,
          context,
          brief,
          channel,
          guidance: verdict.regenerateGuidance,
        });
        body = fixed;
        regenerated = true;
        verdict = await runAntiSlopEditor({
          signalId,
          context,
          brief,
          channel,
          assetBody: body,
        });
      }

      await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          body: asJson(body),
          antiSlopScore: verdict.score,
          antiSlopDetail: asJson(verdict),
          regenCount: regenerated ? 1 : 0,
          reviewStatus: verdict.passes ? "PENDING" : "NEEDS_WORK",
        },
      });
      await settleCost(signalId);
    }

    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "READY" },
    });
  } catch (err) {
    await prisma.signal.update({
      where: { id: signalId },
      data: {
        status: "FAILED",
        statusReason: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
