import { runAgent } from "./runtime";
import {
  SignalScoreSchema,
  type SignalScore,
  type EvidencePacket,
} from "./schemas";

export const PROMPT_VERSION = "significance_scorer.v1";

const INSTRUCTION = `You are the Significance Scorer. Decide whether this signal DESERVES public content.
Prefer fewer, stronger signals. Be a tough editor, not a cheerleader.

Score each dimension 0-100:
- novelty: is this genuinely new or non-obvious?
- businessImpact: does it reflect real impact?
- audienceRelevance: does the target audience care?
- proofStrength: is there concrete evidence (numbers, specifics)?
- educationalValue: would readers learn something useful?
- positioningRelevance: does it advance the company's positioning?
- credibility: is it believable and grounded?
- freshness: is it timely?
- uniqueness: could only THIS company say it (vs. anyone)?

Then set:
- overall (0-100, weighted toward proofStrength, uniqueness, educationalValue),
- recommendation: PUBLISH (>=65 and has a real lesson), MAYBE (45-64 or thin evidence), SKIP (<45 or no proof),
- reasons (specific),
- suggestedChannels,
- missingInfo: what would make this publishable/stronger.

A weak signal with no proof or no lesson must score low and be SKIP/MAYBE with missingInfo.`;

export async function runSignificanceScorer(args: {
  signalId: string;
  context: string;
  evidence: EvidencePacket;
}): Promise<SignalScore> {
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "significance_scorer",
    tier: "reasoning",
    promptVersion: PROMPT_VERSION,
    context: args.context,
    instruction: INSTRUCTION,
    input: `Evidence Packet:\n${JSON.stringify(args.evidence, null, 2)}`,
    schema: SignalScoreSchema,
    maxTokens: 2048,
  });
  return data;
}
