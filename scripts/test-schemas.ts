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
import { pipedriveAdapter } from "../lib/integrations/providers/pipedrive";
import { attioAdapter } from "../lib/integrations/providers/attio";
import { linearAdapter } from "../lib/integrations/providers/linear";
import { githubAdapter } from "../lib/integrations/providers/github";
import { webhookAdapter } from "../lib/integrations/providers/webhook";
import { chunkText } from "../lib/knowledge/chunk";
import { formatProofBlock, type ProofSource } from "../lib/knowledge/retrieve";

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
      bodyMarkdown: "## The blocker\n\n" + "Enterprise AI deals stall on governance evidence, auditability, and access control. ".repeat(12),
      keyTakeaways: ["Governance gates adoption", "Proof beats vision", "Security review is the sales cycle"],
      faq: [
        { question: "What blocks enterprise AI?", answer: "Governance, not model quality." },
        { question: "What evidence matters in AI procurement?", answer: "Audit logs, access controls, and proof that teams can govern usage." },
      ],
      wordCount: 850,
    },
  }).success,
);

// --- Integration adapters (V3) ---
console.log("\nIntegration adapters:");

// Pipedrive: HTTP Basic Auth (user:pass), verify accept/reject, parse, won-filter, map.
{
  const secret = "signalstory:pd_pass_123"; // stored as "user:pass"
  const wonBody = JSON.stringify({
    event: "updated.deal",
    meta: { id: "pd_evt_1", action: "updated", object: "deal", webhook_id: "wh_99" },
    current: { title: "Acme Corp", value: 48000, currency: "USD", status: "won" },
    previous: { status: "open" },
  });
  const auth = "Basic " + Buffer.from(secret).toString("base64");
  const headers = { authorization: auth };

  check("pipedrive verify accepts valid basic auth", pipedriveAdapter.verify({ rawBody: wonBody, headers, secret }));
  check(
    "pipedrive verify rejects wrong basic auth",
    !pipedriveAdapter.verify({ rawBody: wonBody, headers: { authorization: "Basic " + Buffer.from("signalstory:wrong").toString("base64") }, secret }),
  );
  check(
    "pipedrive verify rejects missing auth",
    !pipedriveAdapter.verify({ rawBody: wonBody, headers: {}, secret }),
  );
  const events = pipedriveAdapter.parse(wonBody, headers);
  check(
    "pipedrive parse → updated.deal with meta.id (not webhook_id)",
    events.length === 1 && events[0].externalId === "pd_evt_1" && events[0].type === "updated.deal",
  );
  check("pipedrive shouldIngest passes a won deal", pipedriveAdapter.shouldIngest(events[0], {}));
  const openBody = JSON.stringify({
    event: "updated.deal",
    meta: { id: "pd_evt_2", action: "updated", object: "deal" },
    current: { title: "Beta Inc", value: 1000, currency: "USD", status: "open" },
  });
  const openEvent = pipedriveAdapter.parse(openBody, {})[0];
  check("pipedrive shouldIngest filters a non-won deal by default", !pipedriveAdapter.shouldIngest(openEvent, {}));
  check("pipedrive shouldIngest can allow non-won when wonDealsOnly=false", pipedriveAdapter.shouldIngest(openEvent, { wonDealsOnly: false }));
  const raw = pipedriveAdapter.toRawInput(events[0]);
  check("pipedrive toRawInput names the deal + value", raw.title.includes("Acme Corp") && raw.evidence.includes("48,000"));

  // v2 shape: action "change", object under meta.entity + data — normalized to "updated.deal".
  const v2Body = JSON.stringify({
    meta: { id: "pd_v2_1", action: "change", entity: "deal", correlation_id: "corr-1" },
    data: { title: "Globex", value: 90000, currency: "USD", status: "won" },
    previous: { status: "open" },
  });
  const v2 = pipedriveAdapter.parse(v2Body, {})[0];
  check(
    "pipedrive parse normalizes v2 change.deal → updated.deal (won)",
    v2.type === "updated.deal" && v2.externalId === "pd_v2_1" && pipedriveAdapter.shouldIngest(v2, {}),
  );
}

// Attio: sign a canned record.updated, verify, parse (id from Idempotency-Key header), map.
{
  const secret = "attio_secret";
  const body = JSON.stringify({ event_type: "record.updated", id: { object_id: "deals", record_id: "r1" }, actor: { type: "workspace-member" } });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const headers = { "attio-signature": sig, "idempotency-key": "idem-1" };

  check("attio verify accepts a valid signature", attioAdapter.verify({ rawBody: body, headers, secret }));
  check("attio verify rejects wrong secret", !attioAdapter.verify({ rawBody: body, headers, secret: "nope" }));
  const events = attioAdapter.parse(body, headers);
  check(
    "attio parse → record.updated with idempotency-key id",
    events.length === 1 && events[0].type === "record.updated" && events[0].externalId === "idem-1",
  );
  check("attio shouldIngest passes record.updated", attioAdapter.shouldIngest(events[0], {}));
  check("attio shouldIngest filters disallowed type", !attioAdapter.shouldIngest(events[0], { events: ["list-entry.created"] }));
  const raw = attioAdapter.toRawInput(events[0]);
  check("attio toRawInput produces a CRM title", raw.title.length > 0 && raw.metadata?.provider === "attio");
}

// Linear: sign a canned completed Issue.update, verify, parse (delivery id from header), completed-filter, map.
{
  const secret = "lin_secret";
  const body = JSON.stringify({
    type: "Issue",
    action: "update",
    data: { title: "Ship dark mode", identifier: "ENG-42", state: { name: "Done", type: "completed" } },
    url: "https://linear.app/x/ENG-42",
  });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const headers = { "linear-signature": sig, "linear-delivery": "deliv-uuid-1" };

  check("linear verify accepts a valid signature", linearAdapter.verify({ rawBody: body, headers, secret }));
  const events = linearAdapter.parse(body, headers);
  check(
    "linear parse → Issue.update with delivery id",
    events.length === 1 && events[0].type === "Issue.update" && events[0].externalId === "deliv-uuid-1",
  );
  check("linear shouldIngest passes a completed issue", linearAdapter.shouldIngest(events[0], {}));
  const openBody = JSON.stringify({ type: "Issue", action: "update", data: { title: "WIP", state: { name: "In Progress", type: "started" } } });
  const openEvent = linearAdapter.parse(openBody, { "linear-delivery": "deliv-2" })[0];
  check("linear shouldIngest filters a non-completed issue by default", !linearAdapter.shouldIngest(openEvent, {}));
  const raw = linearAdapter.toRawInput(events[0]);
  check("linear toRawInput says shipped + names the issue", raw.title.includes("Ship dark mode"));
}

// Generic webhook: bearer auth (accept/reject) + body-hash dedup fallback + passthrough map.
{
  const secret = "shared_bearer_secret_long";
  const mapped = JSON.stringify({
    externalId: "ext-123",
    type: "deal.won",
    title: "Closed Globex",
    description: "Signed a 2-year contract.",
    evidence: "ARR $120k",
    links: ["https://crm/deal/123"],
  });
  check("webhook verify accepts a matching bearer header", webhookAdapter.verify({ rawBody: mapped, headers: { authorization: `Bearer ${secret}` }, secret }));
  check("webhook verify accepts x-webhook-secret header", webhookAdapter.verify({ rawBody: mapped, headers: { "x-webhook-secret": secret }, secret }));
  check("webhook verify rejects a wrong bearer", !webhookAdapter.verify({ rawBody: mapped, headers: { authorization: "Bearer nope" }, secret }));
  check("webhook verify rejects a missing bearer", !webhookAdapter.verify({ rawBody: mapped, headers: {}, secret }));
  const events = webhookAdapter.parse(mapped, {});
  check("webhook parse → uses supplied externalId + type", events.length === 1 && events[0].externalId === "ext-123" && events[0].type === "deal.won");
  const noId = webhookAdapter.parse(JSON.stringify({ title: "X" }), {});
  const noId2 = webhookAdapter.parse(JSON.stringify({ title: "X" }), {});
  check("webhook parse → falls back to a stable body hash when no id", noId[0].externalId.length === 64 && noId[0].externalId === noId2[0].externalId);
  const raw = webhookAdapter.toRawInput(events[0]);
  check("webhook toRawInput passes mapped fields through", raw.title === "Closed Globex" && raw.links[0] === "https://crm/deal/123");
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

  // GitHub's DEFAULT content type is form-urlencoded (payload=<urlencoded JSON>).
  const formBody = "payload=" + encodeURIComponent(body);
  const formHeaders = {
    "content-type": "application/x-www-form-urlencoded",
    "x-github-event": "release",
    "x-github-delivery": "deliv-2",
  };
  const formEvents = githubAdapter.parse(formBody, formHeaders);
  check(
    "github parse handles form-urlencoded payload (GitHub default)",
    formEvents.length === 1 && formEvents[0].type === "release.published",
  );
}

// --- V5: memory store (chunking, proof block, cited brief) ---
console.log("\nV5 memory / RAG:");
{
  // Chunker: deterministic, respects size, never drops content empty.
  const para = "Para with enough words to matter. ".repeat(20); // ~700 chars
  const doc = [para, para, para, para, para].join("\n\n"); // ~3500 chars
  const chunks = chunkText(doc, { maxChars: 1200, overlapChars: 100 });
  check("chunkText splits a long doc into multiple chunks", chunks.length > 1);
  check("chunkText respects maxChars (+overlap slack)", chunks.every((c) => c.length <= 1200 + 200));
  check("chunkText is deterministic", JSON.stringify(chunkText(doc, { maxChars: 1200, overlapChars: 100 })) === JSON.stringify(chunks));
  check("chunkText returns [] for empty input", chunkText("   ").length === 0);

  // Proof block: empty when no sources; citation-tagged when present.
  check("formatProofBlock empty with no sources", formatProofBlock([]) === "");
  const sources: ProofSource[] = [
    { id: "S1", chunkId: "c1", docId: "d1", title: "Acme case study", sourceUrl: null, kind: "CASE_STUDY", excerpt: "Acme cut onboarding 40%.", score: 0.82 },
    { id: "S2", chunkId: "c2", docId: "d2", title: "v2.3 changelog", sourceUrl: "https://x/r", kind: "CHANGELOG", excerpt: "Shipped SSO.", score: 0.71 },
  ];
  const block = formatProofBlock(sources);
  check("formatProofBlock tags sources by id", block.includes("[S1]") && block.includes("[S2]") && block.includes("Acme cut onboarding"));

  // NarrativeBrief now carries citedClaims (required; empty array allowed).
  const brief = {
    audience: "B2B founders",
    thesis: "Governance, not model quality, gates enterprise AI.",
    narrativeArc: ["hook", "proof", "lesson"],
    keyArguments: ["Buyers ask for audit logs first"],
    objections: [{ objection: "Isn't this just features?", response: "No — it's trust." }],
    cta: "Audit your governance story before your next enterprise call.",
    positioning: "Reinforces our governance-first wedge.",
    citedClaims: [
      { claim: "Acme cut onboarding 40%", sourceIds: ["S1"], supported: true },
      { claim: "Everyone wants SSO", sourceIds: [], supported: false },
    ],
  };
  check("NarrativeBrief parses with citedClaims", NarrativeBriefSchema.safeParse(brief).success);
  check("NarrativeBrief parses with empty citedClaims (no proof retrieved)", NarrativeBriefSchema.safeParse({ ...brief, citedClaims: [] }).success);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll schema checks passed.");
