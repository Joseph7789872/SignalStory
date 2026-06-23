import { runAgent } from "./runtime";
import { getActivePrompt } from "./prompts";
import {
  NarrativeBriefSchema,
  type NarrativeBrief,
  type StoryAngles,
  type EvidencePacket,
} from "./schemas";

export const PROMPT_VERSION = "narrative_strategist.v1";

export const INSTRUCTION = `You are the Narrative Strategist. Turn the chosen story angle into a strategic Narrative Brief.
This brief becomes the single source of truth for all downstream content — it is not the content itself.

Define: the specific audience; the thesis (one controlling idea); the narrative arc (ordered beats); the key arguments; likely objections and crisp responses; a CTA (what the reader should think or do); and how this advances the company's positioning.
Ground every element in the evidence and the company context. Be specific and opinionated — reflect the founder's beliefs.

If a RETRIEVED PROOF section is present, ground the brief's key claims in it and populate citedClaims: for each important factual claim, cite the supporting source ids (e.g. ["S1"]) and set supported=true. If no retrieved source backs a claim, set sourceIds=[] and supported=false — never fabricate a citation. If no proof was retrieved, return citedClaims as an empty array.`;

export async function runNarrativeStrategist(args: {
  signalId: string;
  context: string;
  evidence: EvidencePacket;
  angles: StoryAngles;
  retrieved?: string;
}): Promise<NarrativeBrief> {
  const recommended =
    args.angles.angles[args.angles.recommendedIndex] ?? args.angles.angles[0];
  const prompt = await getActivePrompt("narrative_strategist", {
    version: PROMPT_VERSION,
    instruction: INSTRUCTION,
  }, args.signalId);
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "narrative_strategist",
    tier: "reasoning",
    promptVersion: prompt.version,
    context: args.context,
    instruction: prompt.instruction,
    input:
      `Chosen story angle:\n${JSON.stringify(recommended, null, 2)}\n\n` +
      `All angles (for context):\n${JSON.stringify(args.angles.angles, null, 2)}\n\n` +
      `Evidence Packet:\n${JSON.stringify(args.evidence, null, 2)}` +
      (args.retrieved ? `\n\n${args.retrieved}` : ""),
    schema: NarrativeBriefSchema,
    maxTokens: 3072,
  });
  return data;
}
