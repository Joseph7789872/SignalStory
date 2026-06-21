import { runAgent } from "./runtime";
import {
  NarrativeBriefSchema,
  type NarrativeBrief,
  type StoryAngles,
  type EvidencePacket,
} from "./schemas";

export const PROMPT_VERSION = "narrative_strategist.v1";

const INSTRUCTION = `You are the Narrative Strategist. Turn the chosen story angle into a strategic Narrative Brief.
This brief becomes the single source of truth for all downstream content — it is not the content itself.

Define: the specific audience; the thesis (one controlling idea); the narrative arc (ordered beats); the key arguments; likely objections and crisp responses; a CTA (what the reader should think or do); and how this advances the company's positioning.
Ground every element in the evidence and the company context. Be specific and opinionated — reflect the founder's beliefs.`;

export async function runNarrativeStrategist(args: {
  signalId: string;
  context: string;
  evidence: EvidencePacket;
  angles: StoryAngles;
}): Promise<NarrativeBrief> {
  const recommended =
    args.angles.angles[args.angles.recommendedIndex] ?? args.angles.angles[0];
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "narrative_strategist",
    tier: "reasoning",
    promptVersion: PROMPT_VERSION,
    context: args.context,
    instruction: INSTRUCTION,
    input:
      `Chosen story angle:\n${JSON.stringify(recommended, null, 2)}\n\n` +
      `All angles (for context):\n${JSON.stringify(args.angles.angles, null, 2)}\n\n` +
      `Evidence Packet:\n${JSON.stringify(args.evidence, null, 2)}`,
    schema: NarrativeBriefSchema,
    maxTokens: 3072,
  });
  return data;
}
