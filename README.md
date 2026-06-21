# SignalStory

Turns meaningful company signals into founder-quality thought leadership.
Context first, writing last — a 6-agent pipeline gated by an anti-slop editor.

> **Thesis:** AI content feels like AI because it starts with writing. Great
> content starts with context. SignalStory detects a signal, scores whether it
> deserves content, finds the story, builds the narrative, writes per-channel,
> and only ships what survives anti-slop review.

## Pipeline

```
Manual signal → [1] Normalizer → [2] Significance Scorer (gate)
→ [3] Story Finder → [4] Narrative Strategist → [5] Channel Transformer
→ [6] Anti-Slop Editor → Human review (approve / regenerate / reject)
```

Models are **cost-tiered by capability** (`lib/agents/models.ts`): an extraction
tier, a reasoning/judgment tier, and a writing tier. The LLM layer is
**provider-agnostic** — a thin interface (`lib/agents/provider.ts`) with OpenAI
and Anthropic adapters, switched by the `LLM_PROVIDER` env var. Every agent
reasons against a cached, deterministic **context bundle**
(`lib/context/bundle.ts`) built from the org's founder beliefs, brand voice, and
editorial strategy.

## Stack

Next.js 14 (App Router) · TypeScript · **Supabase (Postgres + Auth)** · Prisma ·
**OpenAI or Anthropic** (provider-agnostic) · Tailwind + shadcn/ui · Zod.

## Setup

1. Create a **Supabase** project. In the SQL/dashboard, under
   **Authentication → Providers → Email**, optionally turn **off** "Confirm
   email" for quick local testing (otherwise new sign-ups must confirm by email
   before signing in).
2. Get an **OpenAI** and/or **Anthropic** API key.

```bash
cp .env.example .env   # fill in LLM_PROVIDER + key, and the Supabase values
npm install
npm run db:push        # creates tables in Supabase (uses DIRECT_URL)
npm run dev
```

Sign up → you're routed to `/onboarding` to fill the context layer → submit a
signal at `/signals/new` and watch the pipeline run.

### Switching LLM provider

Set `LLM_PROVIDER=openai` or `anthropic` (if unset, it's inferred from whichever
key is present). Override the model per tier with
`OPENAI_MODEL_REASONING`, `ANTHROPIC_MODEL_WRITING`, etc.

## Verification

```bash
npm run test        # offline: agent output schemas + JSON-schema converter
npm run test:e2e    # live: needs DATABASE_URL/DIRECT_URL + an LLM key + db:push
npx tsc --noEmit    # typecheck
npm run build       # production build
```

`test:e2e` runs a strong signal (expects READY + 3 reviewed assets + prompt-cache
reuse on later Opus agents) and a weak signal (expects the significance gate to
stop it at REJECTED).

## Layout

- `lib/agents/*` — the six agents, the runtime wrapper, schemas, model config.
- `lib/context/bundle.ts` — the cached context prefix (the moat).
- `lib/pipeline/orchestrator.ts` — step-wise, persisted, resumable runner.
- `app/api/*` — signals, asset review/regenerate, context CRUD.
- `app/(dashboard|signals|context|onboarding)` — the UI.

## Notes

- **V1 job runtime** is in-process fire-and-forget; the orchestrator persists
  after each step and is resumable-from-status, so a durable queue
  (Inngest/Trigger.dev) is a drop-in for Phase 2.
- Architecture + roadmap: see the plan in `~/.claude/plans/`.
