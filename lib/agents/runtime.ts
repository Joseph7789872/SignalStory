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

/**
 * Slice the first balanced JSON object from `s`, starting at the first `{`.
 * String literals (and their escapes) are tracked so braces *inside* strings —
 * common in writing-tier output like blog bodies — don't end the object early.
 * Returns null if no balanced object is found.
 */
function sliceBalancedObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Extract a JSON object from model text (tolerates code fences / stray prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const sliced = sliceBalancedObject(candidate);
  if (sliced === null) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(sliced);
}

export async function runAgent<T>(
  args: RunAgentArgs<T>,
): Promise<AgentResult<T>> {
  const provider = await getProvider();
  const schema = zodToJsonSchema(args.schema);
  let lastError: unknown;
  let model = "";
  // On a parse/validation failure we append a repair instruction to the next
  // attempt instead of resending the identical request (which usually fails
  // identically). Every attempt — success OR failure — writes an AgentRun with
  // its usage/cost, so a failed-but-billed attempt is still counted by the cost
  // guardrail and the org spend cap.
  let repairHint = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let usage: { inputTokens: number; outputTokens: number; cachedTokens: number } | undefined;
    try {
      const result = await provider.complete({
        tier: args.tier,
        cachedContext: args.context,
        instruction: args.instruction,
        input: repairHint ? `${args.input}\n\n${repairHint}` : args.input,
        schema,
        maxTokens: args.maxTokens ?? 4096,
      });
      model = result.model;
      usage = result.usage;

      const data = args.schema.parse(extractJson(result.text));

      const costUsd = estimateCostUsd(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedTokens,
      );

      await prisma.agentRun.create({
        data: {
          signalId: args.signalId,
          agent: args.agent,
          model: `${provider.name}:${model}`,
          promptVersion: args.promptVersion,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cachedTokens,
          costUsd,
          latencyMs: Date.now() - started,
          status: "ok",
        },
      });

      return { data, costUsd };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      // Record this attempt's spend even though it failed validation. If the
      // provider call itself succeeded (usage set) the tokens were really spent.
      const costUsd = usage
        ? estimateCostUsd(model, usage.inputTokens, usage.outputTokens, usage.cachedTokens)
        : 0;
      await prisma.agentRun.create({
        data: {
          signalId: args.signalId,
          agent: args.agent,
          model: model ? `${provider.name}:${model}` : provider.name,
          promptVersion: args.promptVersion,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          cacheReadTokens: usage?.cachedTokens ?? 0,
          costUsd,
          latencyMs: Date.now() - started,
          status: "error",
          error: message,
        },
      });
      repairHint =
        `Your previous response was rejected (${message}). ` +
        `Return ONLY a single JSON object that validates against the schema — ` +
        `no prose, no code fences.`;
    }
  }

  throw lastError;
}
