import { inngest } from "./client";
import { runPipeline, type StepRunner } from "@/lib/pipeline/orchestrator";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { contentReadyEmail } from "@/lib/email/templates";

/**
 * Durable pipeline runner. Each agent stage in `runPipeline` is wrapped in
 * `step.run`, so Inngest memoizes completed stages and retries/resumes from the
 * stage that failed. We adapt Inngest's `step` to the orchestrator's small
 * StepRunner shape at the boundary (Inngest types the return as Jsonify<T>;
 * agent outputs are plain JSON, so erasing the wrapper here is safe).
 */
export const runPipelineFn = inngest.createFunction(
  { id: "run-pipeline", retries: 2, triggers: [{ event: "signal/submitted" }] },
  async ({ event, step }) => {
    const runner: StepRunner = {
      run: (id, fn) => step.run(id, fn as () => Promise<unknown>) as never,
    };
    const signalId = event.data.signalId as string;
    await runPipeline(signalId, runner);

    // Notify the human author when content is ready to review. Durable + once
    // (memoized step); skipped for auto-ingested signals (no userId) and when
    // the run didn't reach READY. Best-effort — sendEmail never throws.
    await step.run("notify-content-ready", async () => {
      const signal = await prisma.signal.findUnique({
        where: { id: signalId },
        select: {
          status: true,
          rawInput: true,
          user: { select: { email: true } },
          _count: { select: { assets: true } },
        },
      });
      if (signal?.status === "READY" && signal.user?.email) {
        const title =
          (signal.rawInput as { title?: string } | null)?.title ?? "Your signal";
        await sendEmail({
          to: signal.user.email,
          ...contentReadyEmail({
            signalId,
            title,
            assetCount: signal._count.assets,
          }),
        });
        return { notified: true };
      }
      return { notified: false };
    });

    return { signalId };
  },
);

export const functions = [runPipelineFn];
