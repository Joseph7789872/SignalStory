import { z } from "zod";

// --- [1] Event Listener / Normalizer ---
export const EvidencePacketSchema = z.object({
  eventType: z
    .string()
    .describe(
      "Short classification, e.g. enterprise_deal, product_launch, milestone, hire, churn_learning",
    ),
  summary: z.string().describe("One-sentence neutral summary of what happened"),
  entities: z.array(z.string()).describe("Named entities involved"),
  metrics: z
    .array(z.string())
    .describe("Concrete numbers/metrics mentioned, verbatim"),
  facts: z.array(z.string()).describe("Discrete factual claims extracted"),
  links: z.array(z.string()).describe("Supporting URLs, if any"),
  dateContext: z.string().describe("When this happened / recency context"),
  completeness: z
    .number()
    .int()
    .describe("0-100: how complete the evidence is for storytelling"),
});
export type EvidencePacket = z.infer<typeof EvidencePacketSchema>;

// --- [2] Significance Scorer ---
export const SignalScoreSchema = z.object({
  dimensions: z.object({
    novelty: z.number().int(),
    businessImpact: z.number().int(),
    audienceRelevance: z.number().int(),
    proofStrength: z.number().int(),
    educationalValue: z.number().int(),
    positioningRelevance: z.number().int(),
    credibility: z.number().int(),
    freshness: z.number().int(),
    uniqueness: z.number().int(),
  }),
  overall: z.number().int().describe("0-100 weighted overall significance"),
  recommendation: z
    .enum(["PUBLISH", "MAYBE", "SKIP"])
    .describe("Whether this signal deserves content"),
  reasons: z.array(z.string()).describe("Concrete reasons for the score"),
  suggestedChannels: z
    .array(z.enum(["LINKEDIN_FOUNDER", "X_THREAD", "BLOG_OUTLINE"]))
    .describe("Channels this signal suits best"),
  missingInfo: z
    .array(z.string())
    .describe("What additional info would strengthen the story"),
});
export type SignalScore = z.infer<typeof SignalScoreSchema>;

// --- [3] Story Finder ---
export const StoryAnglesSchema = z.object({
  angles: z.array(
    z.object({
      title: z.string(),
      type: z.enum([
        "lesson",
        "surprise",
        "market_implication",
        "validated_belief",
        "challenged_assumption",
        "takeaway",
      ]),
      thesis: z.string().describe("The non-obvious point, not the event"),
      proofPoints: z.array(z.string()),
      whyItMatters: z.string(),
    }),
  ),
  recommendedIndex: z
    .number()
    .int()
    .describe("Index into angles of the strongest angle"),
});
export type StoryAngles = z.infer<typeof StoryAnglesSchema>;

// --- [4] Narrative Strategist ---
export const NarrativeBriefSchema = z.object({
  audience: z.string().describe("Who this is for, specifically"),
  thesis: z.string().describe("The single controlling idea"),
  narrativeArc: z.array(z.string()).describe("Ordered beats of the argument"),
  keyArguments: z.array(z.string()),
  objections: z.array(
    z.object({ objection: z.string(), response: z.string() }),
  ),
  cta: z.string().describe("What the reader should think/do next"),
  positioning: z
    .string()
    .describe("How this advances the company's positioning"),
});
export type NarrativeBrief = z.infer<typeof NarrativeBriefSchema>;

// --- [5] Channel Transformer (per-channel bodies) ---
export const LinkedinFounderSchema = z.object({
  hook: z.string().describe("First line; must earn the scroll-stop"),
  body: z.string().describe("Post body, founder voice, no fluff"),
  takeaway: z.string(),
  hashtags: z.array(z.string()),
});
export type LinkedinFounder = z.infer<typeof LinkedinFounderSchema>;

export const XThreadSchema = z.object({
  tweets: z
    .array(z.string())
    .describe("Each <= 280 chars; first tweet is the hook"),
});
export type XThread = z.infer<typeof XThreadSchema>;

export const BlogOutlineSchema = z.object({
  workingTitle: z.string(),
  targetReader: z.string(),
  sections: z.array(
    z.object({ heading: z.string(), beats: z.array(z.string()) }),
  ),
});
export type BlogOutline = z.infer<typeof BlogOutlineSchema>;

export const ChannelBundleSchema = z.object({
  linkedinFounder: LinkedinFounderSchema,
  xThread: XThreadSchema,
  blogOutline: BlogOutlineSchema,
});
export type ChannelBundle = z.infer<typeof ChannelBundleSchema>;

// Per-channel schema lookup for single-channel regeneration.
export const CHANNEL_SCHEMA = {
  LINKEDIN_FOUNDER: LinkedinFounderSchema,
  X_THREAD: XThreadSchema,
  BLOG_OUTLINE: BlogOutlineSchema,
} as const;

export const CHANNEL_BUNDLE_KEY = {
  LINKEDIN_FOUNDER: "linkedinFounder",
  X_THREAD: "xThread",
  BLOG_OUTLINE: "blogOutline",
} as const;

// --- [6] Anti-Slop Editor ---
export const AntiSlopScoreSchema = z.object({
  score: z.number().int().describe("0-100; higher = more original/credible"),
  passes: z.boolean().describe("Whether it clears the publish bar"),
  couldGptWriteThis: z
    .boolean()
    .describe("Could a generic model write this WITHOUT the company context?"),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      note: z.string(),
    }),
  ),
  regenerateGuidance: z
    .string()
    .describe("Concrete instructions to fix it if it fails"),
});
export type AntiSlopScore = z.infer<typeof AntiSlopScoreSchema>;
