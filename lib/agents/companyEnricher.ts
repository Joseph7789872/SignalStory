import { getProvider } from "./provider";
import { extractJson } from "./runtime";
import { zodToJsonSchema } from "./json-schema";
import { CompanyEnrichmentSchema, type CompanyEnrichment } from "./schemas";

// Context auto-enrichment. Unlike the pipeline agents, enrichment is NOT
// signal-scoped, so it can't go through runAgent (which writes an AgentRun keyed
// by signalId). It calls the provider directly with the cheap extraction tier.
// Output is a suggestion the user reviews before saving.

export const PROMPT_VERSION = "company_enricher.v1";

export const INSTRUCTION = `You extract a company's positioning and voice from raw website text.
Return ONLY the requested JSON. Be faithful to the text — do not invent facts,
numbers, or customers. If something isn't evident, give a conservative best guess
in the company's own words. Keep each field concise.`;

export async function runCompanyEnricher(
  websiteText: string,
): Promise<CompanyEnrichment> {
  const provider = await getProvider();
  const result = await provider.complete({
    tier: "extraction",
    cachedContext: "",
    instruction: INSTRUCTION,
    input: websiteText.slice(0, 24_000), // keep the extraction call cheap
    schema: zodToJsonSchema(CompanyEnrichmentSchema),
    maxTokens: 2048,
  });
  return CompanyEnrichmentSchema.parse(extractJson(result.text));
}
