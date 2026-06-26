/**
 * V5 pgvector finishing step. `prisma db push` (with extensions = [vector])
 * creates the `vector` extension + the MemoryChunk.embedding column, but Prisma
 * does NOT manage vector indexes. This adds an HNSW cosine index so similarity
 * search stays fast as the store grows. Idempotent. Run AFTER db push:
 *   npx prisma db push && npx tsx scripts/migrate-v5-pgvector.ts
 */
import { prisma } from "@/lib/db";

async function main() {
  // Safety net: ensure the extension exists even if the schema route didn't run it.
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

  // HNSW (no training/rebuild as rows grow, good recall) with cosine distance —
  // matches the `<=>` operator used in lib/knowledge/retrieve.ts.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS memorychunk_embedding_hnsw
       ON "MemoryChunk" USING hnsw (embedding vector_cosine_ops)`,
  );

  const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint AS count FROM pg_indexes WHERE indexname = 'memorychunk_embedding_hnsw'`,
  );
  console.log(
    `pgvector ready. HNSW cosine index present: ${Number(count) === 1 ? "yes" : "NO"}`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
