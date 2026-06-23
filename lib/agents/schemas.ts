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
    .array(z.enum(["LINKEDIN_FOUNDER", "X_THREAD", "BLOG_POST"]))
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
  citedClaims: z
    .array(
      z.object({
        claim: z.string().describe("A key factual claim made in the brief"),
        sourceIds: z
          .array(z.string())
          .describe(
            'Citation ids from RETRIEVED PROOF that back this claim, e.g. ["S1","S3"]. Empty if none.',
          ),
        supported: z
          .boolean()
          .describe(
            "True ONLY if at least one retrieved source genuinely backs the claim",
          ),
      }),
    )
    .describe(
      "Key claims grounded in the retrieved proof. Cite real source ids; mark supported=false for any claim no retrieved source backs (do not invent citations). Empty array if no proof was retrieved.",
    ),
});
export type NarrativeBrief = z.infer<typeof NarrativeBriefSchema>;

// --- [5] Channel Transformer (per-channel bodies) ---
// NOTE: these validate Channel Transformer *model output*. OpenAI structured
// output does NOT hard-enforce maxLength/minItems/pattern — they're only hints —
// so a hard Zod .max()/.min()/.regex() here turns normal model variance (e.g. a
// 62-char SEO title) into a pipeline failure. Keep the limits as `.describe()`
// guidance to the model; do not enforce bounds the provider can't guarantee.
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

// A COMPLETE, publish-ready blog post - not an outline - with basic on-page SEO
// and GEO (generative-engine optimization) metadata so the post is both
// rankable and extractable/citable by AI answer engines.
export const BlogPostSchema = z.object({
  seoTitle: z
    .string()
    .describe("SEO <title>, <= 60 chars, leads with the primary keyword"),
  metaDescription: z
    .string()
    .describe(
      "Meta description, <= 155 chars, compelling, includes the primary keyword",
    ),
  slug: z
    .string()
    .describe("URL slug: kebab-case, keyword-rich, no stop-word filler"),
  primaryKeyword: z
    .string()
    .describe("The single primary search/intent phrase the post targets"),
  secondaryKeywords: z
    .array(z.string())
    .describe("Related keywords/entities to weave in naturally (no stuffing)"),
  h1: z.string().describe("On-page H1 headline; may differ from the SEO title"),
  tldr: z
    .string()
    .describe(
      "2-3 sentence direct-answer summary at the top - the quotable answer an AI engine can extract (GEO)",
    ),
  bodyMarkdown: z
    .string()
    .describe(
      "The FULL post in Markdown: ## / ### headings phrased as searched questions, short scannable paragraphs, concrete numbers, a clear point of view, ~700-1100 words. No banned phrases, no AI-tells.",
    ),
  keyTakeaways: z
    .array(z.string())
    .describe("3-5 standalone, extractable takeaways (GEO)"),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z
          .string()
          .describe("Self-contained answer, 1-3 sentences, for answer engines"),
      }),
    )
    .describe("2-4 Q&A pairs targeting real queries (AEO/GEO; FAQPage-ready)"),
  wordCount: z.number().int().describe("Approximate word count of bodyMarkdown"),
});
export type BlogPost = z.infer<typeof BlogPostSchema>;

export const ChannelBundleSchema = z.object({
  linkedinFounder: LinkedinFounderSchema,
  xThread: XThreadSchema,
  blogPost: BlogPostSchema,
});
export type ChannelBundle = z.infer<typeof ChannelBundleSchema>;
// Per-channel schema lookup for single-channel regeneration.
export const CHANNEL_SCHEMA = {
  LINKEDIN_FOUNDER: LinkedinFounderSchema,
  X_THREAD: XThreadSchema,
  BLOG_POST: BlogPostSchema,
} as const;

export const CHANNEL_BUNDLE_KEY = {
  LINKEDIN_FOUNDER: "linkedinFounder",
  X_THREAD: "xThread",
  BLOG_POST: "blogPost",
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
