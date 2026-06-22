/**
 * Live integration test for the V3 webhook ingestion path. Requires the dev
 * server running (npm run dev) — and ideally the Inngest dev server too, though
 * the send failure is tolerated. Seeds a Stripe connection, POSTs correctly
 * signed events, and asserts: a Signal is created, replays dedup, and
 * below-threshold events are filtered (no Signal).
 *   npx tsx scripts/simulate-webhook.ts
 */
import crypto from "crypto";

import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = "whsec_sim_secret";
const ORG_SLUG = "ingest-test-org";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ok" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

function stripeSignedHeaders(body: string): Record<string, string> {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  return { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` };
}

function chargeEvent(id: string, amountCents: number): string {
  return JSON.stringify({
    id,
    type: "charge.succeeded",
    data: { object: { amount: amountCents, currency: "usd", customer: "cus_sim" } },
  });
}

async function ensureConnection(): Promise<{ orgId: string; token: string }> {
  const org =
    (await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })) ??
    (await prisma.organization.create({
      data: {
        name: "Ingest Test Co",
        slug: ORG_SLUG,
        profile: { create: { description: "Test org for webhook ingestion." } },
        founder: { create: {} },
        brandVoice: { create: {} },
        editorial: { create: {} },
      },
    }));

  // Fresh connection each run; clean prior signals/events for a clean assert.
  const existing = await prisma.integrationConnection.findFirst({
    where: { orgId: org.id, provider: "STRIPE" },
  });
  if (existing) {
    await prisma.signal.deleteMany({ where: { connectionId: existing.id } });
    await prisma.ingestedEvent.deleteMany({ where: { connectionId: existing.id } });
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: { secret: encryptSecret(SECRET), config: { minAmountUsd: 100 }, status: "ACTIVE" },
    });
    return { orgId: org.id, token: existing.webhookToken };
  }
  const conn = await prisma.integrationConnection.create({
    data: {
      orgId: org.id,
      provider: "STRIPE",
      secret: encryptSecret(SECRET),
      config: { minAmountUsd: 100 },
      label: "Sim Stripe",
    },
  });
  return { orgId: org.id, token: conn.webhookToken };
}

async function post(token: string, body: string) {
  const res = await fetch(`${BASE}/api/webhooks/stripe/${token}`, {
    method: "POST",
    headers: stripeSignedHeaders(body),
    body,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function signalCount(connectionId: string) {
  return prisma.signal.count({ where: { connectionId } });
}

async function main() {
  const { token } = await ensureConnection();
  const conn = await prisma.integrationConnection.findFirstOrThrow({
    where: { webhookToken: token },
  });

  console.log(`\n=== Webhook ingestion (POST ${BASE}/api/webhooks/stripe/${token}) ===`);

  // 1) Valid $2500 charge → 1 signal created, source STRIPE.
  const big = chargeEvent("evt_sim_big", 250000);
  const r1 = await post(token, big);
  check("valid charge accepted (200, ingested 1)", r1.status === 200 && r1.json.ingested === 1, JSON.stringify(r1.json));
  const afterFirst = await signalCount(conn.id);
  check("one signal created", afterFirst === 1);
  const sig = await prisma.signal.findFirst({ where: { connectionId: conn.id } });
  check("signal.source === STRIPE and userId is null", sig?.source === "STRIPE" && sig?.userId === null);

  // 2) Replay the same event id → dedup, no new signal.
  const r2 = await post(token, big);
  check("replay deduped (ingested 0)", r2.status === 200 && r2.json.ingested === 0);
  check("still one signal after replay", (await signalCount(conn.id)) === 1);

  // 3) Below-threshold charge → filtered, no signal.
  const small = chargeEvent("evt_sim_small", 50); // $0.50 < $100 threshold
  const r3 = await post(token, small);
  check("below-threshold filtered (ingested 0)", r3.status === 200 && r3.json.ingested === 0);
  check("no new signal from filtered event", (await signalCount(conn.id)) === 1);

  // 4) Bad signature → 401.
  const bad = await fetch(`${BASE}/api/webhooks/stripe/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: big,
  });
  check("bad signature rejected (401)", bad.status === 401);

  // 5) Unknown token → 404.
  const unknown = await post("does-not-exist", big);
  check("unknown token rejected (404)", unknown.status === 404);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
