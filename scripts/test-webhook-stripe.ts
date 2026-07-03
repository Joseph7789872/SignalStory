/**
 * Offline Stripe-webhook logic tests (no DB, no keys, no network).
 * Run: npx tsx scripts/test-webhook-stripe.ts  (or: npm run test:webhook)
 *
 * Covers the pure billing logic exported by app/api/stripe/webhook/route.ts:
 * mapStatus (Stripe status → our Subscription.status) and resolvePlan
 * (status + price id → PlanId). The route module reads env at load, so fake
 * env is set BEFORE the dynamic import.
 */

process.env.STRIPE_SECRET_KEY = "sk_test_offline_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline_placeholder";
process.env.STRIPE_PRICE_STARTER = "price_test_starter";
process.env.STRIPE_PRICE_PRO = "price_test_pro";
// lib/db constructs PrismaClient at import — a fake URL keeps it inert (no
// query ever runs in this test).
process.env.DATABASE_URL ??= "postgresql://offline:offline@localhost:5432/offline";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

async function main() {
  const { mapStatus, resolvePlan } = await import(
    "../app/api/stripe/webhook/route"
  );

  console.log("\nstripe-webhook mapStatus:");
  check("active → active", mapStatus("active") === "active");
  check("trialing → active", mapStatus("trialing") === "active");
  check("past_due → past_due", mapStatus("past_due") === "past_due");
  check("incomplete → past_due", mapStatus("incomplete") === "past_due");
  check("canceled → canceled", mapStatus("canceled") === "canceled");
  check("unpaid → canceled", mapStatus("unpaid") === "canceled");
  check(
    "incomplete_expired → canceled",
    mapStatus("incomplete_expired") === "canceled",
  );
  check("paused → canceled", mapStatus("paused") === "canceled");

  console.log("\nstripe-webhook resolvePlan:");
  check(
    "active + starter price → STARTER",
    resolvePlan("active", "price_test_starter") === "STARTER",
  );
  check(
    "active + pro price → PRO",
    resolvePlan("active", "price_test_pro") === "PRO",
  );
  check(
    "trialing + pro price → PRO",
    resolvePlan("trialing", "price_test_pro") === "PRO",
  );
  check(
    "canceled + pro price → FREE (cancel always wins)",
    resolvePlan("canceled", "price_test_pro") === "FREE",
  );
  check(
    "active + unknown price → FREE",
    resolvePlan("active", "price_unknown") === "FREE",
  );
  check("active + null price → FREE", resolvePlan("active", null) === "FREE");
  check(
    "past_due keeps the paid plan",
    resolvePlan("past_due", "price_test_starter") === "STARTER",
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll stripe-webhook checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
