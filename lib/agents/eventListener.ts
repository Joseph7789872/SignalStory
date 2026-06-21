import { runAgent } from "./runtime";
import { EvidencePacketSchema, type EvidencePacket } from "./schemas";

export const PROMPT_VERSION = "event_listener.v1";

const INSTRUCTION = `You are the Event Listener. You normalize a raw company signal into a structured Evidence Packet.
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
  const { data } = await runAgent({
    signalId: args.signalId,
    agent: "event_listener",
    tier: "extraction",
    promptVersion: PROMPT_VERSION,
    context: args.context,
    instruction: INSTRUCTION,
    input: `Raw signal submission:\n${JSON.stringify(args.rawInput, null, 2)}`,
    schema: EvidencePacketSchema,
    maxTokens: 2048,
  });
  return data;
}
