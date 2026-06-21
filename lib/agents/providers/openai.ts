import OpenAI from "openai";

import { resolveModel } from "../models";
import type { CompleteArgs, CompleteResult, LLMProvider } from "../provider";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI | null = null;

  private c(): OpenAI {
    if (!this.client) this.client = new OpenAI();
    return this.client;
  }

  async complete(args: CompleteArgs): Promise<CompleteResult> {
    const model = resolveModel("openai", args.tier);

    // Context first as its own system message → eligible for OpenAI's automatic
    // prompt caching (prefix-based, no explicit control). Native strict
    // json_schema enforces the output shape.
    const resp = await this.c().chat.completions.create({
      model,
      max_completion_tokens: args.maxTokens,
      messages: [
        { role: "system", content: args.cachedContext },
        { role: "system", content: args.instruction },
        { role: "user", content: args.input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_output",
          strict: true,
          schema: args.schema,
        },
      },
    });

    const text = resp.choices[0]?.message?.content ?? "";
    const usage = resp.usage;

    return {
      text,
      model,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
    };
  }
}
