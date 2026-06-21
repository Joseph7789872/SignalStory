/**
 * Offline verification (no secrets needed): every agent output schema converts
 * to a valid object JSON Schema, and representative payloads parse.
 * Run: npx tsx scripts/test-schemas.ts
 */
import { z } from "zod";

import { zodToJsonSchema } from "../lib/agents/json-schema";
import {
  EvidencePacketSchema,
  SignalScoreSchema,
  StoryAnglesSchema,
  NarrativeBriefSchema,
  ChannelBundleSchema,
  AntiSlopScoreSchema,
} from "../lib/agents/schemas";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

const schemas: [string, z.ZodTypeAny][] = [
  ["EvidencePacket", EvidencePacketSchema],
  ["SignalScore", SignalScoreSchema],
  ["StoryAngles", StoryAnglesSchema],
  ["NarrativeBrief", NarrativeBriefSchema],
  ["ChannelBundle", ChannelBundleSchema],
  ["AntiSlopScore", AntiSlopScoreSchema],
];

console.log("JSON Schema conversion:");
for (const [name, schema] of schemas) {
  const js = zodToJsonSchema(schema) as any;
  check(
    `${name} -> object schema`,
    js.type === "object" &&
      !!js.properties &&
      Array.isArray(js.required) &&
      js.additionalProperties === false,
    JSON.stringify(js).slice(0, 120),
  );
}

console.log("\nSample payload validation:");
check(
  "SignalScore parses",
  SignalScoreSchema.safeParse({
    dimensions: {
      novelty: 70,
      businessImpact: 60,
      audienceRelevance: 80,
      proofStrength: 75,
      educationalValue: 85,
      positioningRelevance: 70,
      credibility: 80,
      freshness: 90,
      uniqueness: 65,
    },
    overall: 74,
    recommendation: "PUBLISH",
    reasons: ["Concrete proof", "Non-obvious lesson"],
    suggestedChannels: ["LINKEDIN_FOUNDER"],
    missingInfo: [],
  }).success,
);

check(
  "AntiSlopScore parses",
  AntiSlopScoreSchema.safeParse({
    score: 82,
    passes: true,
    couldGptWriteThis: false,
    checks: [{ name: "specificity", passed: true, note: "uses real numbers" }],
    regenerateGuidance: "",
  }).success,
);

check(
  "ChannelBundle parses",
  ChannelBundleSchema.safeParse({
    linkedinFounder: {
      hook: "h",
      body: "b",
      takeaway: "t",
      hashtags: ["x"],
    },
    xThread: { tweets: ["t1", "t2"] },
    blogOutline: {
      workingTitle: "wt",
      targetReader: "tr",
      sections: [{ heading: "h", beats: ["b1"] }],
    },
  }).success,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll schema checks passed.");
