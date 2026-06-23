import { runAgent } from "./runtime";
import { getActivePrompt } from "./prompts";
import { EvidencePacketSchema, type EvidencePacket } from "./schemas";

export const PROMPT_VERSION = "event_listener.v1";

export const INSTRUCTION = `You are the Event Listener. You normalize a raw company signal into a structured Evidence Packet.
Your job is extraction and classification, NOT writing or opinion.
- Pull out concrete facts, metrics (verbatim numbers), entities, and links.
- Classify the event type with a short snake_case label.
- Judge completeness (0-100): is there enough here to build a credible, specific story?
Do not invent facts. If something is not stated, leave it out.`;

export async function runEventListener(args: {
  signalId: string;
  context: string;
  rawInput: unknown;
}): Promise<EvidencePacket> {
  const prompt = await getActivePrompt("event_listener", {
    version: PROMPT_VERSION,
    instruction: INSTRUCTION,
  }, args.signalId);
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "event_listener",
    tier: "extraction",
    promptVersion: prompt.version,
    context: args.context,
    instruction: prompt.instruction,
    input: `Raw signal submission:\n${JSON.stringify(args.rawInput, null, 2)}`,
    schema: EvidencePacketSchema,
    maxTokens: 2048,
  });
  return data;
}
