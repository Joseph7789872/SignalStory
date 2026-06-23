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

/**
 * Step abstraction so the same pipeline runs both in-process (tests, the
 * passthrough below) and under a durable queue. Inngest's `step.run` memoizes
 * each step's result and skips completed steps on retry/replay — combined with
 * the orchestrator persisting status/output before each step, the pipeline is
 * resumable-from-status. The passthrough just executes inline.
 */
export type StepRunner = {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
};
const passthrough: StepRunner = { run: (_id, fn) => fn() };

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
 * Runs the 6-agent pipeline. Each stage persists its output and advances
 * Signal.status before the next stage, and is wrapped in a `step.run` so a
 * durable queue can retry/resume a single stage. Defaults to in-process.
 */
export async function runPipeline(
  signalId: string,
  step: StepRunner = passthrough,
): Promise<void> {
  const claim = await prisma.signal.updateMany({
    where: { id: signalId, status: { in: ["QUEUED", "FAILED"] } },
    data: { status: "NORMALIZING", statusReason: null },
  });
  if (claim.count === 0) {
    const existing = await prisma.signal.findUnique({
      where: { id: signalId },
      select: { status: true },
    });
    if (!existing) throw new Error(`Signal not found: ${signalId}`);
    if (existing.status === "READY" || existing.status === "REJECTED") return;
    // Another worker is already handling this signal.
    return;
  }

  try {
    const { context, rawInput } = await step.run("load", async () => {
      const signal = await prisma.signal.findUniqueOrThrow({
        where: { id: signalId },
      });
      const context = await buildContextBundle(signal.orgId);
      return { context, rawInput: signal.rawInput as unknown };
    });

    // [1] Event Listener / Normalizer
    const evidence = await step.run("normalize", async () => {
      await prisma.signal.update({
        where: { id: signalId },
        data: { status: "NORMALIZING" },
      });
      const evidence: EvidencePacket = await runEventListener({
        signalId,
        context,
        rawInput,
      });
      await prisma.signal.update({
        where: { id: signalId },
        data: { evidencePacket: asJson(evidence) },
      });
      await settleCost(signalId);
      return evidence;
    });

    // [2] Significance Scorer — the gate
    const gate = await step.run("score", async () => {
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
        data: { significanceScore: score.overall, scoreDetail: asJson(score) },
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
        return { skip: true as const };
      }
      return { skip: false as const, score };
    });
    if (gate.skip) return;
    const score = gate.score;

    // [3] Story Finder
    const angles = await step.run("story", async () => {
      await prisma.signal.update({
        where: { id: signalId },
        data: { status: "STORY" },
      });
      const angles = await runStoryFinder({
        signalId,
        context,
        evidence,
        score,
      });
      await prisma.signal.update({
        where: { id: signalId },
        data: { storyAngles: asJson(angles) },
      });
      await settleCost(signalId);
      return angles;
    });

    // [4] Narrative Strategist
    const brief = await step.run("narrative", async () => {
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
      return brief;
    });

    // [5] Channel Transformer
    await step.run("channel", async () => {
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
    });

    // [6] Anti-Slop Editor (per asset, one bounded regenerate). Each channel is
    // its own step so a durable retry re-edits only the channel that failed.
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: "EDITING" },
    });
    for (const { channel } of CHANNELS) {
      await step.run(`edit-${channel}`, async () => {
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
      });
    }

    await step.run("finalize", async () => {
      await prisma.signal.update({
        where: { id: signalId },
        data: { status: "READY" },
      });
    });
  } catch (err) {
    await prisma.signal.update({
      where: { id: signalId },
      data: {
        status: "FAILED",
        statusReason: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
