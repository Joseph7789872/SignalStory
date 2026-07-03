# Production runbook: adopt `prisma migrate` (H7)

**Owner-run steps — do not automate.** These commands touch the production
database. Run them once, in order, from a machine whose `.env` points
`DIRECT_URL` at **production**.

## What's already prepared (committed in this repo)

- `prisma/migrations/0_init/` — baseline of the schema as it exists in prod
  today (all tables, enums, the `vector` extension, **plus** the HNSW cosine
  index from `scripts/migrate-v5-pgvector.ts`, folded in).
- `prisma/migrations/20260703120000_stripe_webhook_idempotency/` — the first
  real migration: `ProcessedStripeEvent` table + `Subscription.lastStripeEventAt`.
- `.gitignore` no longer ignores `prisma/migrations/`.

## Steps (production)

1. **Back up the prod DB first.** Supabase Dashboard → Database → Backups —
   confirm a current daily backup / PITR restore point exists. Do not proceed
   without one.

2. **Mark the baseline as already applied** (it describes what prod already
   has — nothing is executed against the schema):

   ```bash
   npx prisma migrate resolve --applied 0_init
   ```

3. **Verify the HNSW index actually exists in prod** (the baseline assumes it —
   it was created by `scripts/migrate-v5-pgvector.ts`). In the Supabase SQL
   editor:

   ```sql
   SELECT indexname FROM pg_indexes WHERE indexname = 'memorychunk_embedding_hnsw';
   ```

   If it's missing, run the index SQL from `prisma/migrations/0_init/migration.sql`
   (the last statement) manually once.

4. **Deploy the pending migration** (creates `ProcessedStripeEvent`, adds
   `Subscription.lastStripeEventAt`):

   ```bash
   npx prisma migrate deploy
   ```

5. **Check status** — should report "Database schema is up to date":

   ```bash
   npx prisma migrate status
   ```

## Every other environment (staging/local dev DBs that already have the schema)

Same two commands: `npx prisma migrate resolve --applied 0_init`, then
`npx prisma migrate deploy`.

## Fresh databases (new environments)

Just `npx prisma migrate deploy` — the baseline runs for real and produces the
full schema including the vector extension + HNSW index. Then verify with
`npm run test:knowledge` (needs `OPENAI_API_KEY`).

## Going forward

- Local schema change → `npx prisma migrate dev --name <change>` → commit the
  generated folder.
- Deploy → `npx prisma migrate deploy` (add to the Vercel build or a deploy
  step; it is a no-op when nothing is pending).
- `npm run db:push` only for throwaway local experiments.
