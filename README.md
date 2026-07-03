# SignalStory

**Turns meaningful company signals into founder-quality thought leadership â€” context first, writing last.**

A multi-agent content pipeline where the writing model runs *last*, gated by an anti-slop editor, and every stage is grounded in proprietary context before a single word is written.

> **The thesis:** AI content feels like AI because it starts with writing. Great content starts with *context*. So SignalStory inverts the usual "prompt â†’ post" flow: it detects a signal, scores whether it even deserves content, finds the story, builds the narrative, writes per-channel, and only ships what survives an anti-slop review.

Built with Next.js 14, TypeScript, a provider-agnostic LLM layer (OpenAI or Anthropic), Supabase, and Prisma.

---

## How it works

```
Manual signal
   â”‚
   â–¼
[1] Event Listener   â”€â”€ extraction tier â”€â”€â–º  Evidence Packet (structured facts)
[2] Significance Scorer â”€ reasoning tier â”€â–º  Score + recommendation   â—„â”€â”€ THE GATE
   â”‚                                          (SKIP â†’ rejected, with "what's missing")
   â–¼
[3] Story Finder        â”€ reasoning tier â”€â–º  Story angles (event â‰  content)
[4] Narrative Strategist â”€ reasoning tier â–º  Narrative brief (the source of truth)
[5] Channel Transformer â”€â”€ writing tier â”€â”€â–º  LinkedIn post Â· X thread Â· full SEO/GEO blog post
[6] Anti-Slop Editor    â”€ reasoning tier â”€â–º  "Could a generic model write this WITHOUT the context?"
   â”‚                                          (fail â†’ one bounded regenerate, then flag for human)
   â–¼
Human review â†’ approve / regenerate / reject  â†’  feedback captured
```

Two things make the output *not* read like GPT:

1. **The gate.** Most "events" don't deserve content. The Significance Scorer can reject a signal outright and tell you exactly what evidence would make it publishable â€” so the pipeline never dresses up a non-story.
2. **The anti-slop editor.** A separate model judgment with an explicit rubric asks the killer question: *could a generic model have written this without the company's proprietary context?* If yes, it fails and regenerates with concrete guidance.

---

## What makes it interesting (engineering)

- **Context is the moat, and it's cached.** Every agent reasons against a deterministic, byte-stable **context bundle** (`lib/context/bundle.ts`) â€” founder beliefs, brand voice, banned phrases, editorial strategy â€” placed as a cache-marked prompt prefix so same-model agents in a run reuse it.
- **Provider-agnostic LLM layer.** Agents never name a model; they pass a **tier** (`extraction | reasoning | writing`). `lib/agents/models.ts` maps `(provider, tier) â†’ model id`, and adapters (`providers/openai.ts`, `providers/anthropic.ts`) handle the rest. Switching providers â€” or models â€” touches one file. Set `LLM_PROVIDER=openai | anthropic`.
- **Schemas single-sourced from Zod.** Every agent's output is a Zod schema; a custom `zodToJsonSchema` converts it to the JSON Schema sent to the model (OpenAI strict `json_schema`; Anthropic JSON-in-text). The same shapes are what land in Postgres JSON columns â€” one contract, no drift.
- **Resumable orchestration.** `runPipeline()` persists each step's output and advances `Signal.status` *before* the next step, so it's resumable-from-status. The V1 in-process trigger can be swapped for a durable queue (Inngest/Trigger.dev) without touching agent logic.
- **Cost & quality observability.** Every model call records an `AgentRun` (model, tokens, cache reads, cost, latency). A per-run cost guardrail aborts runaway pipelines.
- **Basic SEO + GEO out of the box.** The blog channel emits a complete, publish-ready post with on-page SEO (title/meta/slug/keywords/headings) and GEO/answer-engine structure (TL;DR direct answer, key takeaways, FAQ) â€” content designed to be both rankable and citable by AI search.

---

## Stack

| | |
|---|---|
| **Framework** | Next.js 14 (App Router), TypeScript (strict), React 18 |
| **Auth + DB** | Supabase (Postgres + Auth via `@supabase/ssr`), Prisma |
| **LLM** | OpenAI **or** Anthropic â€” provider-agnostic, tier-based |
| **UI** | Tailwind CSS + shadcn/ui (Radix) |
| **Validation** | Zod (API input + single-source agent schemas) |

---

## Setup

1. Create a **Supabase** project. Under **Authentication â†’ Providers â†’ Email**, turn **off** "Confirm email" for frictionless local testing.
2. Get an **OpenAI** and/or **Anthropic** API key.

```bash
cp .env.example .env   # fill in LLM_PROVIDER + key + the Supabase values
npm install
npm run db:push        # create tables in Supabase (uses DIRECT_URL)
npm run dev
```

Sign up â†’ you're routed to `/onboarding` to fill the context layer â†’ submit a signal at `/signals/new` and watch the pipeline run live.

**Switching provider/model:** set `LLM_PROVIDER` (or leave it unset to infer from whichever key is present). Override any tier with `OPENAI_MODEL_REASONING`, `ANTHROPIC_MODEL_WRITING`, etc.

---

## Verification

```bash
npm run test        # offline: agent output schemas + the zodâ†’JSON-schema converter (no keys)
npm run test:e2e    # live: full pipeline twice â€” needs DB + an LLM key + db:push first
npx tsc --noEmit    # typecheck
npm run build       # production build (typechecks; lint is separate)
npm run lint        # eslint . (flat config, ESLint 9)
npm run typecheck   # tsc --noEmit
```

`test:e2e` runs a **strong signal** (expects `READY` + 3 reviewed assets) and a **weak signal** (expects the significance gate to stop it at `REJECTED`), and reports per-run cost.

---

## Project layout

```
lib/agents/         the six agents + runtime wrapper, Zod schemas, model/provider config
  providers/        OpenAI + Anthropic adapters
lib/context/        buildContextBundle() â€” the cached context prefix (the moat)
lib/pipeline/       orchestrator.ts â€” step-wise, persisted, resumable runner
lib/supabase/       server / client / middleware auth clients
app/api/            signals, asset review/regenerate, context CRUD, health
app/(dashboard|signals|context|onboarding)   the UI
prisma/schema.prisma   data model (context layer + pipeline + audit)
scripts/            offline schema test + live e2e pipeline test
```

---

## Status & roadmap

**V1 (shipped):** manual signals Â· context layer Â· significance gate Â· story/narrative/channel agents Â· full SEO/GEO blog + LinkedIn + X Â· anti-slop review with bounded regenerate Â· approve/reject/regenerate Â· per-run cost audit Â· provider-agnostic LLM Â· Supabase auth + DB.

**V2 (shipped):** durable job queue (Inngest, retryable/resumable per agent stage) Â· in-app inline editing of every channel Â· JSON-LD (`Article`+`FAQPage`) on the blog Â· Customer Voice repository woven into the context bundle Â· cost/quality analytics dashboard Â· prompt versioning with per-version feedback performance.

**V3 (shipped):** auto-ingestion / event listeners â€” a provider-agnostic ingestion layer (signature-verified webhooks â†’ dedup â†’ coarse filter â†’ Signal â†’ same pipeline), encrypted connection secrets, and an `/integrations` UI. Manual entry is now just one source among many.

**V4 (shipped):** CRM + universal connectors â€” native signed-inbound **Pipedrive**, **Attio**, and **Linear** connectors (deal won / record updated / issue shipped) plus a generic **Incoming Webhook (Zapier/Make)** adapter that authenticates with the URL token + a shared bearer secret, so any tool without a native connector (HubSpot, Salesforce, Gong, Slack, â€¦) can pipe events in. Stripe was retired in favor of the lower-trust-ask CRM path; dedup is now per-connection. _Notion deferred â€” its sparse inbound payloads need Notion-API enrichment._

**V5 (next):** Company Knowledge RAG (pgvector) Â· OAuth-native connectors Â· Notion API enrichment Â· LLM-driven prompt auto-tuning Â· publishing/scheduling.

> The pipeline runs on a durable queue but the orchestrator stayed unchanged â€” each agent stage was already persisted and resumable-from-status, so the queue wrapped it via a small `StepRunner` seam rather than a rewrite.
