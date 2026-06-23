import { z } from "zod";

import { runAgent } from "./runtime";
import { getActivePrompt } from "./prompts";
import {
  ChannelBundleSchema,
  CHANNEL_SCHEMA,
  type ChannelBundle,
  type NarrativeBrief,
} from "./schemas";

export const PROMPT_VERSION = "channel_transformer.v3";

const BASE = `You are the Channel Transformer. You write the FINAL content — the last step, not the first.
Write multiple representations of ONE story (the Narrative Brief), not separate stories.
Rules:
- Sound like the founder. Match the brand voice exactly. Never use banned phrases.
- Be specific: use the real numbers, names, and lessons. No generic filler.
- No clichés, no "in today's fast-paced world", no hollow hype, no AI-tells.
- Earn the first line. Teach something. Reflect a real point of view.
- A competitor must NOT be able to publish the same words.`;

// Basic SEO + GEO (generative-engine optimization) rules for the blog post.
const BLOG_SEO_RULES = `Write the COMPLETE post, ready to publish — never an outline. Apply basic SEO + GEO:
- Target ONE primary keyword/intent; weave secondary keywords and named entities in naturally (no stuffing).
- seoTitle <= 60 chars with the keyword first; metaDescription <= 155 chars; slug kebab-case and keyword-rich.
- Open with a TL;DR that directly answers the core question in 2-3 sentences (so AI answer engines can extract it).
- Use descriptive ## / ### Markdown headings phrased as the questions readers actually search.
- Use concrete numbers and a clear point of view; keep paragraphs short and scannable.
- End with 3-5 standalone key takeaways and a 2-4 item FAQ of self-contained Q&As (FAQPage-ready).`;

export const BUNDLE_INSTRUCTION = `${BASE}

Produce all three channel assets from the brief:
- linkedinFounder: a founder-voice LinkedIn post (hook, body, takeaway, hashtags).
- xThread: an X thread (array of tweets, each <= 280 chars, first tweet is the hook).
- blogPost: a complete, publish-ready, SEO/GEO-optimized blog post (not an outline).

${BLOG_SEO_RULES}`;

export async function runChannelTransformer(args: {
  signalId: string;
  context: string;
  brief: NarrativeBrief;
}): Promise<ChannelBundle> {
  const prompt = await getActivePrompt("channel_transformer", {
    version: PROMPT_VERSION,
    instruction: BUNDLE_INSTRUCTION,
  }, args.signalId);
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "channel_transformer",
    tier: "writing",
    promptVersion: prompt.version,
    context: args.context,
    instruction: prompt.instruction,
    input: `Narrative Brief:\n${JSON.stringify(args.brief, null, 2)}`,
    schema: ChannelBundleSchema,
    maxTokens: 8000,
  });
  return data;
}

type ChannelKey = keyof typeof CHANNEL_SCHEMA;

const CHANNEL_DESC: Record<ChannelKey, string> = {
  LINKEDIN_FOUNDER:
    "a founder-voice LinkedIn post (hook, body, takeaway, hashtags)",
  X_THREAD: "an X thread (tweets array, each <= 280 chars)",
  BLOG_POST: `a complete, SEO/GEO-optimized blog post (seoTitle, metaDescription, slug, primaryKeyword, secondaryKeywords, h1, tldr, bodyMarkdown, keyTakeaways, faq, wordCount).\n\n${BLOG_SEO_RULES}`,
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
    maxTokens: 6000,
  });
  return data;
}
