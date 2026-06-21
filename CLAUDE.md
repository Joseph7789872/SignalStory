# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SignalStory turns manually-submitted company "signals" into founder-quality
B2B content via a **6-agent pipeline that writes last** and gates output through
an anti-slop editor. The product thesis: AI content feels generic because it
starts with writing — here every stage is grounded in proprietary context
(founder beliefs, brand voice, editorial strategy) before any writing happens.

## Commands

```bash
npm run dev            # Next.js dev server
npm run build          # production build (also runs lint + typecheck)
npx tsc --noEmit       # typecheck only
npm run test           # OFFLINE: validates agent output schemas + the zod→JSON-schema converter (no keys needed)
npm run test:e2e       # LIVE: runs the full pipeline twice (strong + weak signal); needs DB + an LLM key + db:push first
npm run db:push        # apply prisma/schema.prisma to the DB (uses DIRECT_URL)
npm run db:studio      # Prisma Studio
npx prisma generate    # regenerate the client after editing the schema
```

There is no unit-test runner; verification is the offline schema test
(`scripts/test-schemas.ts`) plus the live pipeline script
(`scripts/test-pipeline.ts`). Both run via `tsx` and resolve the `@/` path alias.

## Environment

`.env` (git-ignored; template in `.env.example`). Needs an LLM key
(`OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, selected by `LLM_PROVIDER`),
Supabase values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`),
and Postgres URLs (`DATABASE_URL` pooled + `DIRECT_URL` direct).

## Architecture (the parts that span multiple files)

**Provider-agnostic LLM layer.** Agents never name a concrete model. They pass a
`tier` (`extraction | reasoning | writing`) to `runAgent` (`lib/agents/runtime.ts`).
`lib/agents/provider.ts` picks an adapter (`providers/openai.ts` or
`providers/anthropic.ts`) based on `resolveProvider()`; `lib/agents/models.ts`
maps `(provider, tier) → model id` (env-overridable, e.g. `OPENAI_MODEL_REASONING`)
and holds pricing for the in-app cost estimate. To add a provider or change model
choice, touch only `models.ts` + a new adapter — agents and the orchestrator are
untouched. OpenAI uses native strict `json_schema` output; Anthropic uses
JSON-in-text with a cached context system block. Both return raw text; `runAgent`
extracts the JSON (`extractJson`) and validates with the agent's Zod schema.

**The 6 agents** (`lib/agents/*.ts`) are thin: each exports a `run*` function +
a `PROMPT_VERSION` and an INSTRUCTION string, and calls `runAgent` with its Zod
output schema from `lib/agents/schemas.ts`. Order + tier:
1. `eventListener` (extraction) → EvidencePacket
2. `significanceScorer` (reasoning) → SignalScore — **the gate**
3. `storyFinder` (reasoning) → StoryAngles
4. `narrativeStrategist` (reasoning) → NarrativeBrief (source of truth)
5. `channelTransformer` (writing) → ChannelBundle (LinkedIn/X/blog); also exports
   `regenerateChannel` for single-channel re-writes
6. `antiSlopEditor` (reasoning) → AntiSlopScore (`couldGptWriteThis`, `passes`)

**Schemas are single-sourced from Zod.** `schemas.ts` defines every agent output
as a Zod schema; `json-schema.ts` (`zodToJsonSchema`) converts to the JSON Schema
sent to the model. These same shapes are what get stored in Postgres JSON columns
— so the DB stays loosely typed and the Zod schemas are the contract. When adding
or changing an agent's output, edit the Zod schema; do not hand-write JSON Schema.

**Pipeline orchestration** (`lib/pipeline/orchestrator.ts`, `runPipeline(signalId)`).
Runs steps 1→6 sequentially, **persisting each step's output and advancing
`Signal.status` before the next step** (statuses: QUEUED→NORMALIZING→SCORING→
STORY→NARRATIVE→CHANNEL→EDITING→READY, plus REJECTED/FAILED). This step-wise
persistence makes it resumable-from-status, so the current in-process
fire-and-forget trigger (`void runPipeline(id)` in `POST /api/signals`) can be
swapped for a durable queue later without changing agent logic. Two control
points live here: the **significance gate** (`recommendation === "SKIP"` →
REJECTED with `missingInfo`) and the **bounded anti-slop loop** (one regenerate
per asset, then mark NEEDS_WORK). A per-run cost guardrail (`settleCost`) aborts
to FAILED past `PIPELINE_MAX_COST_USD`.

**Prompt caching** is intentional: the deterministic context bundle
(`lib/context/bundle.ts`, `buildContextBundle(orgId)`) is placed as the first,
cache-marked system block so same-model agents in a run reuse it. The bundle is
built in a stable byte order — keep it deterministic or caching breaks. The live
e2e test asserts cache reuse on later same-tier agents.

**Auth + tenancy** (Supabase). `lib/supabase/{server,client,middleware}.ts` wrap
`@supabase/ssr`. `middleware.ts` refreshes the session and gates protected routes.
`lib/auth.ts` `getOrCreateAuthContext()` is the key pattern: it reads the Supabase
user and **lazily provisions a `User` + single-tenant `Organization` (with empty
context records) on first request** — there is no separate signup webhook. Every
API route calls `requireAuthContext()` and scopes all queries by `org.id`.

**Context layer = the moat.** `Organization` has one each of
`OrganizationProfile / FounderProfile / BrandVoice / EditorialStrategy`
(`prisma/schema.prisma`), edited via `app/(context|onboarding)` + the single
`/api/context` GET/PUT endpoint. List-ish fields are stored as JSON arrays
(beliefs, frameworks, pillars…) and rendered into the bundle.

## Conventions

- Path alias `@/*` → repo root (works in app code and in `tsx` scripts).
- API routes are `force-dynamic`, auth-guarded, and org-scoped; validate input
  with Zod.
- LLM clients are constructed lazily (inside the adapters) so importing modules
  during `next build` never requires API keys.
- Model ids exist only in `lib/agents/models.ts`. Don't hardcode a model
  elsewhere.
