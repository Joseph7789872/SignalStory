import Anthropic from "@anthropic-ai/sdk";

import { resolveModel } from "../models";
import type { CompleteArgs, CompleteResult, LLMProvider } from "../provider";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic | null = null;

  private c(): Anthropic {
    if (!this.client) this.client = new Anthropic();
    return this.client;
  }

  async complete(args: CompleteArgs): Promise<CompleteResult> {
    const model = resolveModel("anthropic", args.tier);

    // System: [cached context] then [instruction + schema]. The cache_control
    // breakpoint makes the context prefix reusable across same-model agents.
    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: args.cachedContext,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text:
          `${args.instruction}\n\n` +
          `Respond with ONLY a single JSON object that validates against this JSON Schema. ` +
          `No markdown, no code fences, no commentary.\n\nJSON Schema:\n${JSON.stringify(
            args.schema,
          )}`,
      },
    ];

    const resp = await this.c().messages.create({
      model,
      max_tokens: args.maxTokens,
      system,
      messages: [{ role: "user", content: args.input }],
    });

    // A truncated response (hit the token ceiling) yields unparseable JSON;
    // surface the real cause instead of letting it look like malformed output.
    if (resp.stop_reason === "max_tokens") {
      throw new Error(
        `Anthropic output truncated at max_tokens=${args.maxTokens}; raise maxTokens for this agent`,
      );
    }

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const usage = resp.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };

    return {
      text,
      model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cachedTokens: usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}
