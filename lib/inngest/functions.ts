import { inngest } from "./client";
import { runPipeline, type StepRunner } from "@/lib/pipeline/orchestrator";

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
    await runPipeline(event.data.signalId as string, runner);
    return { signalId: event.data.signalId };
  },
);

export const functions = [runPipelineFn];
