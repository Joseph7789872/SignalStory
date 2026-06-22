/**
 * One-shot V4 enum migration. Postgres can't DROP an enum value, so we reuse the
 * BLOG_OUTLINE→BLOG_POST rename trick: delete the leftover STRIPE rows, rename the
 * now-unused STRIPE value to PIPEDRIVE, and ADD the remaining new values — for both
 * IntegrationProvider and SignalSource. Idempotent (ADD ... IF NOT EXISTS; the rename
 * is skipped once STRIPE is gone). Run with the dev servers stopped:
 *   npx tsx scripts/migrate-v4-enums.ts
 */
import { prisma } from "@/lib/db";

async function enumValues(typeName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1`,
    typeName,
  );
  return rows.map((r) => r.enumlabel);
}

async function migrateEnum(typeName: string) {
  const before = await enumValues(typeName);
  if (before.includes("STRIPE")) {
    if (before.includes("PIPEDRIVE")) {
      // Both exist (shouldn't normally happen) — nothing to rename.
    } else {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "${typeName}" RENAME VALUE 'STRIPE' TO 'PIPEDRIVE'`,
      );
      console.log(`  ${typeName}: renamed STRIPE → PIPEDRIVE`);
    }
  }
  for (const val of ["PIPEDRIVE", "ATTIO", "LINEAR", "WEBHOOK"]) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${val}'`,
    );
  }
  console.log(`  ${typeName}: now [${(await enumValues(typeName)).join(", ")}]`);
}

async function main() {
  console.log("Deleting leftover STRIPE rows…");
  const ie = await prisma.$executeRawUnsafe(
    `DELETE FROM "IngestedEvent" WHERE "provider" = 'STRIPE'`,
  );
  const sig = await prisma.$executeRawUnsafe(
    `DELETE FROM "Signal" WHERE "source" = 'STRIPE'`,
  );
  const conn = await prisma.$executeRawUnsafe(
    `DELETE FROM "IntegrationConnection" WHERE "provider" = 'STRIPE'`,
  );
  console.log(`  deleted: ${ie} ingested events, ${sig} signals, ${conn} connections`);

  console.log("Migrating enums…");
  await migrateEnum("IntegrationProvider");
  await migrateEnum("SignalSource");

  console.log("Done. Now run: npm run db:push && npx prisma generate");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
