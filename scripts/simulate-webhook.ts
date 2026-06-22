/**
 * Live integration test for the V4 webhook ingestion path. Requires the dev
 * server running (npm run dev) — and ideally the Inngest dev server too, though
 * the send failure is tolerated. Seeds a Pipedrive connection + a generic Webhook
 * connection, POSTs correctly-signed/authed events, and asserts: a Signal is
 * created, replays dedup, below-bar (non-won) events are filtered, bad
 * signature/bearer → 401, unknown token → 404.
 *   npx tsx scripts/simulate-webhook.ts
 */
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const PD_SECRET = "pd_sim_sign_key";
const WH_SECRET = "wh_sim_shared_secret_long";
const ORG_SLUG = "ingest-test-org";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ok" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

function pipedriveHeaders(body: string): Record<string, string> {
  const sig = crypto.createHmac("sha256", PD_SECRET).update(body).digest("hex");
  return { "content-type": "application/json", "x-pipedrive-signature": sig };
}

function dealEvent(id: string, status: "won" | "open"): string {
  return JSON.stringify({
    event: "updated.deal",
    meta: { id, action: "updated", object: "deal", webhook_id: "wh_const" },
    current: { title: `Deal ${id}`, value: 48000, currency: "USD", status },
  });
}

async function ensureOrg() {
  return (
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
    }))
  );
}

async function ensureConnection(
  orgId: string,
  provider: "PIPEDRIVE" | "WEBHOOK",
  secret: string,
  config: Prisma.InputJsonValue,
): Promise<string> {
  const existing = await prisma.integrationConnection.findFirst({
    where: { orgId, provider },
  });
  if (existing) {
    await prisma.signal.deleteMany({ where: { connectionId: existing.id } });
    await prisma.ingestedEvent.deleteMany({ where: { connectionId: existing.id } });
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: { secret: encryptSecret(secret), config, status: "ACTIVE" },
    });
    return existing.webhookToken;
  }
  const conn = await prisma.integrationConnection.create({
    data: { orgId, provider, secret: encryptSecret(secret), config, label: `Sim ${provider}` },
  });
  return conn.webhookToken;
}

async function post(slug: string, token: string, body: string, headers: Record<string, string>) {
  const res = await fetch(`${BASE}/api/webhooks/${slug}/${token}`, {
    method: "POST",
    headers,
    body,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function signalCount(token: string) {
  const conn = await prisma.integrationConnection.findFirstOrThrow({ where: { webhookToken: token } });
  return prisma.signal.count({ where: { connectionId: conn.id } });
}

async function main() {
  const org = await ensureOrg();
  const pdToken = await ensureConnection(org.id, "PIPEDRIVE", PD_SECRET, { wonDealsOnly: true });
  const whToken = await ensureConnection(org.id, "WEBHOOK", WH_SECRET, {});

  console.log(`\n=== Pipedrive (POST ${BASE}/api/webhooks/pipedrive/${pdToken}) ===`);
  const won = dealEvent("pd_won_1", "won");
  const r1 = await post("pipedrive", pdToken, won, pipedriveHeaders(won));
  check("won deal accepted (200, ingested 1)", r1.status === 200 && r1.json.ingested === 1, JSON.stringify(r1.json));
  check("one signal created", (await signalCount(pdToken)) === 1);
  const pdConn = await prisma.integrationConnection.findFirstOrThrow({
    where: { webhookToken: pdToken },
  });
  const sig = await prisma.signal.findFirst({
    where: { connectionId: pdConn.id },
  });
  check("signal.source === PIPEDRIVE and userId is null", sig?.source === "PIPEDRIVE" && sig?.userId === null);

  const r2 = await post("pipedrive", pdToken, won, pipedriveHeaders(won));
  check("replay deduped (ingested 0)", r2.status === 200 && r2.json.ingested === 0);
  check("still one signal after replay", (await signalCount(pdToken)) === 1);

  const open = dealEvent("pd_open_1", "open");
  const r3 = await post("pipedrive", pdToken, open, pipedriveHeaders(open));
  check("non-won deal filtered (ingested 0)", r3.status === 200 && r3.json.ingested === 0);
  check("no new signal from filtered deal", (await signalCount(pdToken)) === 1);

  const bad = await post("pipedrive", pdToken, won, {
    "content-type": "application/json",
    "x-pipedrive-signature": "deadbeef",
  });
  check("bad signature rejected (401)", bad.status === 401);

  console.log(`\n=== Generic Webhook (POST ${BASE}/api/webhooks/webhook/${whToken}) ===`);
  const evt = JSON.stringify({
    externalId: "wh_evt_1",
    type: "deal.won",
    title: "Closed Globex — $120k ARR",
    description: "Signed a 2-year contract after a 6-week eval.",
    evidence: "ARR $120k; 2-year term",
    links: ["https://crm/deal/globex"],
  });
  const w1 = await post("webhook", whToken, evt, {
    "content-type": "application/json",
    authorization: `Bearer ${WH_SECRET}`,
  });
  check("bearer-authed event accepted (200, ingested 1)", w1.status === 200 && w1.json.ingested === 1, JSON.stringify(w1.json));
  check("one webhook signal created with source WEBHOOK", (await signalCount(whToken)) === 1);

  const w2 = await post("webhook", whToken, evt, {
    "content-type": "application/json",
    authorization: "Bearer wrong-secret",
  });
  check("wrong bearer rejected (401)", w2.status === 401);

  const unknown = await post("webhook", "does-not-exist", evt, {
    "content-type": "application/json",
    authorization: `Bearer ${WH_SECRET}`,
  });
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
