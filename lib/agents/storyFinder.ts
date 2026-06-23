import { runAgent } from "./runtime";
import { getActivePrompt } from "./prompts";
import {
  StoryAnglesSchema,
  type StoryAngles,
  type EvidencePacket,
  type SignalScore,
} from "./schemas";

export const PROMPT_VERSION = "story_finder.v1";

export const INSTRUCTION = `You are the Story Finder. Events are not content; stories are.
Given an event, find the underlying STORIES — the lesson, surprise, market implication, validated belief, challenged assumption, or useful takeaway.

Bad: "We signed Acme."
Good: "Enterprise buyers cared far more about governance than AI features."

Produce 3-5 distinct angles. For each: a sharp title, a type, a thesis (the non-obvious point, NOT the event), concrete proof points drawn from the evidence and company context, and why it matters to the audience.
Then pick the strongest angle (recommendedIndex) — the one most specific, most proof-backed, and most aligned with the company's beliefs and positioning.`;

export async function runStoryFinder(args: {
  signalId: string;
  context: string;
  evidence: EvidencePacket;
  score: SignalScore;
}): Promise<StoryAngles> {
  const prompt = await getActivePrompt("story_finder", {
    version: PROMPT_VERSION,
    instruction: INSTRUCTION,
  }, args.signalId);
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "story_finder",
    tier: "reasoning",
    promptVersion: prompt.version,
    context: args.context,
    instruction: prompt.instruction,
    input:
      `Evidence Packet:\n${JSON.stringify(args.evidence, null, 2)}\n\n` +
      `Significance assessment:\n${JSON.stringify(args.score, null, 2)}`,
    schema: StoryAnglesSchema,
    maxTokens: 3072,
  });
  return data;
}
