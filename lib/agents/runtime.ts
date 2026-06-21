import { z } from "zod";

import { prisma } from "@/lib/db";
import { estimateCostUsd, type Tier } from "./models";
import { getProvider } from "./provider";
import { zodToJsonSchema } from "./json-schema";

export type RunAgentArgs<T> = {
  signalId: string;
  agent: string; // stable key, e.g. "significance_scorer"
  tier: Tier;
  promptVersion: string;
  /** Stable, shared context prefix — cached across same-model agents. */
  context: string;
  /** Per-agent role + rubric instruction. */
  instruction: string;
  /** Volatile per-signal input. */
  input: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
};

export type AgentResult<T> = { data: T; costUsd: number };

/** Extract a JSON object from model text (tolerates code fences / stray prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function runAgent<T>(
  args: RunAgentArgs<T>,
): Promise<AgentResult<T>> {
  const provider = await getProvider();
  const schema = zodToJsonSchema(args.schema);
  const started = Date.now();
  let lastError: unknown;
  let model = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete({
        tier: args.tier,
        cachedContext: args.context,
        instruction: args.instruction,
        input: args.input,
        schema,
        maxTokens: args.maxTokens ?? 4096,
      });
      model = result.model;

      const data = args.schema.parse(extractJson(result.text));

      const costUsd = estimateCostUsd(
        model,
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.usage.cachedTokens,
      );

      await prisma.agentRun.create({
        data: {
          signalId: args.signalId,
          agent: args.agent,
          model: `${provider.name}:${model}`,
          promptVersion: args.promptVersion,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cacheReadTokens: result.usage.cachedTokens,
          costUsd,
          latencyMs: Date.now() - started,
          status: "ok",
        },
      });

      return { data, costUsd };
    } catch (err) {
      lastError = err;
    }
  }

  await prisma.agentRun.create({
    data: {
      signalId: args.signalId,
      agent: args.agent,
      model: `${provider.name}:${model}`,
      promptVersion: args.promptVersion,
      latencyMs: Date.now() - started,
      status: "error",
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
  });

  throw lastError;
}
