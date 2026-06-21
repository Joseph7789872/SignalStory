import { z } from "zod";

import { runAgent } from "./runtime";
import {
  ChannelBundleSchema,
  CHANNEL_SCHEMA,
  type ChannelBundle,
  type NarrativeBrief,
} from "./schemas";

export const PROMPT_VERSION = "channel_transformer.v2";

const BASE = `You are the Channel Transformer. You write the FINAL content — the last step, not the first.
Write multiple representations of ONE story (the Narrative Brief), not separate stories.
Rules:
- Sound like the founder. Match the brand voice exactly. Never use banned phrases.
- Be specific: use the real numbers, names, and lessons. No generic filler.
- No clichés, no "in today's fast-paced world", no hollow hype, no AI-tells.
- Earn the first line. Teach something. Reflect a real point of view.
- A competitor must NOT be able to publish the same words.`;

const BUNDLE_INSTRUCTION = `${BASE}

Produce all three channel assets from the brief:
- linkedinFounder: a founder-voice LinkedIn post (hook, body, takeaway, hashtags).
- xThread: an X thread (array of tweets, each <= 280 chars, first tweet is the hook).
- blogOutline: a blog outline (working title, target reader, sections with beats).`;

export async function runChannelTransformer(args: {
  signalId: string;
  context: string;
  brief: NarrativeBrief;
}): Promise<ChannelBundle> {
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "channel_transformer",
    tier: "writing",
    promptVersion: PROMPT_VERSION,
    context: args.context,
    instruction: BUNDLE_INSTRUCTION,
    input: `Narrative Brief:\n${JSON.stringify(args.brief, null, 2)}`,
    schema: ChannelBundleSchema,
    maxTokens: 4096,
  });
  return data;
}

type ChannelKey = keyof typeof CHANNEL_SCHEMA;

const CHANNEL_DESC: Record<ChannelKey, string> = {
  LINKEDIN_FOUNDER:
    "a founder-voice LinkedIn post (hook, body, takeaway, hashtags)",
  X_THREAD: "an X thread (tweets array, each <= 280 chars)",
  BLOG_OUTLINE: "a blog outline (workingTitle, targetReader, sections[])",
};

/** Regenerate a single channel using the anti-slop editor's guidance. */
export async function regenerateChannel<K extends ChannelKey>(args: {
  signalId: string;
  context: string;
  brief: NarrativeBrief;
  channel: K;
  guidance: string;
}): Promise<z.infer<(typeof CHANNEL_SCHEMA)[K]>> {
  const schema = CHANNEL_SCHEMA[args.channel];
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "channel_transformer_regen",
    tier: "writing",
    promptVersion: PROMPT_VERSION,
    context: args.context,
    instruction: `${BASE}\n\nRewrite ${CHANNEL_DESC[args.channel]}. The prior draft failed anti-slop review. Apply this guidance precisely:\n${args.guidance}`,
    input: `Narrative Brief:\n${JSON.stringify(args.brief, null, 2)}`,
    schema: schema as z.ZodType<z.infer<(typeof CHANNEL_SCHEMA)[K]>>,
    maxTokens: 3072,
  });
  return data;
}
