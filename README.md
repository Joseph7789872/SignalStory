# SignalStory

**Turns meaningful company signals into founder-quality thought leadership — context first, writing last.**

A multi-agent content pipeline where the writing model runs *last*, gated by an anti-slop editor, and every stage is grounded in proprietary context before a single word is written.

> **The thesis:** AI content feels like AI because it starts with writing. Great content starts with *context*. So SignalStory inverts the usual "prompt → post" flow: it detects a signal, scores whether it even deserves content, finds the story, builds the narrative, writes per-channel, and only ships what survives an anti-slop review.

Built with Next.js 14, TypeScript, a provider-agnostic LLM layer (OpenAI or Anthropic), Supabase, and Prisma.

---

## How it works

```
Manual signal
   │
   ▼
[1] Event Listener   ── extraction tier ──►  Evidence Packet (structured facts)
[2] Significance Scorer ─ reasoning tier ─►  Score + recommendation   ◄── THE GATE
   │                                          (SKIP → rejected, with "what's missing")
   ▼
[3] Story Finder        ─ reasoning tier ─►  Story angles (event ≠ content)
[4] Narrative Strategist ─ reasoning tier ►  Narrative brief (the source of truth)
[5] Channel Transformer ── writing tier ──►  LinkedIn post · X thread · full SEO/GEO blog post
[6] Anti-Slop Editor    ─ reasoning tier ─►  "Could a generic model write this WITHOUT the context?"
   │                                          (fail → one bounded regenerate, then flag for human)
   ▼
Human review → approve / regenerate / reject  →  feedback captured
```

Two things make the output *not* read like GPT:

1. **The gate.** Most "events" don't deserve content. The Significance Scorer can reject a signal outright and tell you exactly what evidence would make it publishable — so the pipeline never dresses up a non-story.
2. **The anti-slop editor.** A separate model judgment with an explicit rubric asks the killer question: *could a generic model have written this without the company's proprietary context?* If yes, it fails and regenerates with concrete guidance.

---

## What makes it interesting (engineering)

- **Context is the moat, and it's cached.** Every agent reasons against a deterministic, byte-stable **context bundle** (`lib/context/bundle.ts`) — founder beliefs, brand voice, banned phrases, editorial strategy — placed as a cache-marked prompt prefix so same-model agents in a run reuse it.
- **Provider-agnostic LLM layer.** Agents never name a model; they pass a **tier** (`extraction | reasoning | writing`). `lib/agents/models.ts` maps `(provider, tier) → model id`, and adapters (`providers/openai.ts`, `providers/anthropic.ts`) handle the rest. Switching providers — or models — touches one file. Set `LLM_PROVIDER=openai | anthropic`.
- **Schemas single-sourced from Zod.** Every agent's output is a Zod schema; a custom `zodToJsonSchema` converts it to the JSON Schema sent to the model (OpenAI strict `json_schema`; Anthropic JSON-in-text). The same shapes are what land in Postgres JSON columns — one contract, no drift.
- **Resumable orchestration.** `runPipeline()` persists each step's output and advances `Signal.status` *before* the next step, so it's resumable-from-status. The V1 in-process trigger can be swapped for a durable queue (Inngest/Trigger.dev) without touching agent logic.
- **Cost & quality observability.** Every model call records an `AgentRun` (model, tokens, cache reads, cost, latency). A per-run cost guardrail aborts runaway pipelines.
- **Basic SEO + GEO out of the box.** The blog channel emits a complete, publish-ready post with on-page SEO (title/meta/slug/keywords/headings) and GEO/answer-engine structure (TL;DR direct answer, key takeaways, FAQ) — content designed to be both rankable and citable by AI search.

---

## Stack

| | |
|---|---|
| **Framework** | Next.js 14 (App Router), TypeScript (strict), React 18 |
| **Auth + DB** | Supabase (Postgres + Auth via `@supabase/ssr`), Prisma |
| **LLM** | OpenAI **or** Anthropic — provider-agnostic, tier-based |
| **UI** | Tailwind CSS + shadcn/ui (Radix) |
| **Validation** | Zod (API input + single-source agent schemas) |

---

## Setup

1. Create a **Supabase** project. Under **Authentication → Providers → Email**, turn **off** "Confirm email" for frictionless local testing.
2. Get an **OpenAI** and/or **Anthropic** API key.

```bash
cp .env.example .env   # fill in LLM_PROVIDER + key + the Supabase values
npm install
npm run db:push        # create tables in Supabase (uses DIRECT_URL)
npm run dev
```

Sign up → you're routed to `/onboarding` to fill the context layer → submit a signal at `/signals/new` and watch the pipeline run live.

**Switching provider/model:** set `LLM_PROVIDER` (or leave it unset to infer from whichever key is present). Override any tier with `OPENAI_MODEL_REASONING`, `ANTHROPIC_MODEL_WRITING`, etc.

---

## Verification

```bash
npm run test        # offline: agent output schemas + the zod→JSON-schema converter (no keys)
npm run test:e2e    # live: full pipeline twice — needs DB + an LLM key + db:push first
npx tsc --noEmit    # typecheck
npm run build       # production build (also lints + typechecks)
```

`test:e2e` runs a **strong signal** (expects `READY` + 3 reviewed assets) and a **weak signal** (expects the significance gate to stop it at `REJECTED`), and reports per-run cost.

---

## Project layout

```
lib/agents/         the six agents + runtime wrapper, Zod schemas, model/provider config
  providers/        OpenAI + Anthropic adapters
lib/context/        buildContextBundle() — the cached context prefix (the moat)
lib/pipeline/       orchestrator.ts — step-wise, persisted, resumable runner
lib/supabase/       server / client / middleware auth clients
app/api/            signals, asset review/regenerate, context CRUD, health
app/(dashboard|signals|context|onboarding)   the UI
prisma/schema.prisma   data model (context layer + pipeline + audit)
scripts/            offline schema test + live e2e pipeline test
```

---

## Status & roadmap

**V1 (shipped):** manual signals · context layer · significance gate · story/narrative/channel agents · full SEO/GEO blog + LinkedIn + X · anti-slop review with bounded regenerate · approve/reject/regenerate · per-run cost audit · provider-agnostic LLM · Supabase auth + DB.

**V2 (next):** durable job queue · Customer Voice repository · in-app inline editing · richer SEO/GEO (JSON-LD, CMS publish) · prompt versioning + feedback-driven tuning · more channels · multi-user orgs.

> V1's in-process runtime is fire-and-forget, but the orchestrator persists after each step and is resumable-from-status, so the durable queue is a drop-in — not a rewrite.
