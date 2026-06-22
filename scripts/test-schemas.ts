/**
 * Offline verification (no secrets needed): every agent output schema converts
 * to a valid object JSON Schema, and representative payloads parse.
 * Run: npx tsx scripts/test-schemas.ts
 */
import crypto from "crypto";
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
import { stripeAdapter } from "../lib/integrations/providers/stripe";
import { githubAdapter } from "../lib/integrations/providers/github";

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
    blogPost: {
      seoTitle: "Why governance gates enterprise AI adoption",
      metaDescription: "What a 6-week security review taught us about selling AI to banks.",
      slug: "governance-gates-enterprise-ai-adoption",
      primaryKeyword: "enterprise AI governance",
      secondaryKeywords: ["audit logging", "AI procurement"],
      h1: "The real enterprise AI blocker isn't the model",
      tldr: "Enterprise AI deals stall on governance, not capability. Here's the proof.",
      bodyMarkdown: "## The blocker\n\nReal content here with numbers.",
      keyTakeaways: ["Governance gates adoption", "Proof beats vision"],
      faq: [{ question: "What blocks enterprise AI?", answer: "Governance, not model quality." }],
      wordCount: 850,
    },
  }).success,
);

// --- Integration adapters (V3) ---
console.log("\nIntegration adapters:");

// Stripe: sign a canned charge, verify roundtrip + tamper, parse, filter, map.
{
  const secret = "whsec_test_123";
  const body = JSON.stringify({
    id: "evt_1",
    type: "charge.succeeded",
    data: { object: { amount: 250000, currency: "usd", customer: "cus_X" } },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const headers = { "stripe-signature": `t=${t},v1=${sig}` };

  check("stripe verify accepts a valid signature", stripeAdapter.verify({ rawBody: body, headers, secret }));
  check(
    "stripe verify rejects a tampered body",
    !stripeAdapter.verify({ rawBody: body + " ", headers, secret }),
  );
  const events = stripeAdapter.parse(body, headers);
  check("stripe parse → 1 event with externalId+type", events.length === 1 && events[0].externalId === "evt_1" && events[0].type === "charge.succeeded");
  check("stripe shouldIngest passes above threshold", stripeAdapter.shouldIngest(events[0], { minAmountUsd: 1000 }));
  check("stripe shouldIngest filters below threshold", !stripeAdapter.shouldIngest(events[0], { minAmountUsd: 5000 }));
  check("stripe shouldIngest filters disallowed type", !stripeAdapter.shouldIngest(events[0], { events: ["invoice.paid"] }));
  const raw = stripeAdapter.toRawInput(events[0]);
  check("stripe toRawInput has a title + $ amount", raw.title.includes("$2,500") && raw.description.length > 0);
}

// GitHub: sign a canned release.published, verify, parse (type from headers), map.
{
  const secret = "ghsecret";
  const body = JSON.stringify({
    action: "published",
    release: { tag_name: "v2.3.0", html_url: "https://x/r", body: "Notes" },
    repository: { full_name: "acme/app" },
  });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const headers = {
    "x-hub-signature-256": sig,
    "x-github-event": "release",
    "x-github-delivery": "deliv-1",
  };
  check("github verify accepts a valid signature", githubAdapter.verify({ rawBody: body, headers, secret }));
  check("github verify rejects wrong secret", !githubAdapter.verify({ rawBody: body, headers, secret: "nope" }));
  const events = githubAdapter.parse(body, headers);
  check(
    "github parse → release.published with delivery id",
    events.length === 1 && events[0].type === "release.published" && events[0].externalId === "deliv-1",
  );
  check("github shouldIngest passes release.published", githubAdapter.shouldIngest(events[0], {}));
  const raw = githubAdapter.toRawInput(events[0]);
  check("github toRawInput names the version", raw.title.includes("v2.3.0"));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll schema checks passed.");
