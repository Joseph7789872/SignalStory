import { runAgent } from "./runtime";
import { getActivePrompt } from "./prompts";
import {
  AntiSlopScoreSchema,
  type AntiSlopScore,
  type NarrativeBrief,
} from "./schemas";

export const PROMPT_VERSION = "anti_slop_editor.v1";

export const INSTRUCTION = `You are the Anti-Slop Editor. You evaluate generated content BEFORE it can be approved. You are skeptical and concrete.

Run these checks (each passed/failed with a one-line note):
- generic_language: free of clichés and filler?
- supported_claims: claims backed by the evidence/brief, not invented?
- specificity: real numbers/names/specifics present?
- insight: teaches something / has a real point of view?
- founder_voice: sounds like this founder, matches brand voice, no banned phrases?
- ai_structure: avoids tell-tale AI phrasing/cadence/listiness?
- hook_strength: does the opening earn attention?

Then answer the decisive question: couldGptWriteThis — could a generic model produce essentially this WITHOUT the company's proprietary context? If yes, it fails.

Set score 0-100 (higher = more original/credible/grounded). passes = (score >= 70 AND couldGptWriteThis is false). If it fails, regenerateGuidance must be concrete and actionable (what to cut, what specifics to add, what voice to hit).`;

export async function runAntiSlopEditor(args: {
  signalId: string;
  context: string;
  brief: NarrativeBrief;
  channel: string;
  assetBody: unknown;
}): Promise<AntiSlopScore> {
  const prompt = await getActivePrompt("anti_slop_editor", {
    version: PROMPT_VERSION,
    instruction: INSTRUCTION,
  });
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "anti_slop_editor",
    tier: "reasoning",
    promptVersion: prompt.version,
    context: args.context,
    instruction: prompt.instruction,
    input:
      `Channel: ${args.channel}\n\n` +
      `Narrative Brief (the intended story):\n${JSON.stringify(args.brief, null, 2)}\n\n` +
      `Content to evaluate:\n${JSON.stringify(args.assetBody, null, 2)}`,
    schema: AntiSlopScoreSchema,
    maxTokens: 2048,
  });
  return data;
}
