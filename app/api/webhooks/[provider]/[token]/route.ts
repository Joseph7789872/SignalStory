import { NextResponse } from "next/server";
import type { Prisma, SignalSource } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import { decryptSecret } from "@/lib/crypto";
import { inngest } from "@/lib/inngest/client";
import { rateLimit } from "@/lib/ratelimit";
import { getUsage } from "@/lib/billing/quota";
import type { ConnectionConfig, ProviderEvent } from "@/lib/integrations/types";

// Public (NOT auth-gated): third parties POST here with no Supabase session.
// Authenticated instead by the unguessable token + the provider signature.
export const dynamic = "force-dynamic";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

type ClaimedEvent =
  | { kind: "duplicate" }
  | { kind: "filtered" }
  | { kind: "quota_rejected" }
  | { kind: "ingested"; signalId: string; externalId: string };

// Reject obviously-oversized payloads before buffering the whole body.
const MAX_BODY_BYTES = 1_000_000; // 1 MB

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function POST(
  req: Request,
  { params }: { params: { provider: string; token: string } },
) {
  const adapter = getAdapter(params.provider);
  if (!adapter) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      webhookToken: params.token,
      provider: adapter.provider,
      status: "ACTIVE",
    },
  });
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Flood guard keyed on the connection only. The source IP is derived from
  // x-forwarded-for, which the client controls, so including it would let an
  // attacker rotate the rate-limit bucket and evade the cap.
  const rl = await rateLimit(`webhook:${connection.id}`, "webhook");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfter },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  // Reject oversized bodies (cheap header check) before buffering them.
  const declaredLen = Number(req.headers.get("content-length") ?? 0);
  if (declaredLen > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Read the RAW body (needed for signature verification) + lowercased headers.
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let secret: string;
  try {
    secret = decryptSecret(connection.secret);
  } catch {
    return NextResponse.json({ error: "Misconfigured connection" }, { status: 500 });
  }

  if (!adapter.verify({ rawBody, headers, secret })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const config = (connection.config ?? {}) as ConnectionConfig;
  let events: ProviderEvent[];
  try {
    events = adapter.parse(rawBody, headers);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid webhook payload",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  // Quota gate (coarse, evaluated once for this delivery): when the org is over
  // its plan, still record events for dedup integrity but create the Signal as
  // REJECTED and never enqueue it — auto-ingested signals have no human to prompt.
  const usage = await getUsage(connection.orgId);
  const quotaBlocked = usage.overSignalQuota || usage.overSpendCap;

  let ingested = 0;
  let filtered = 0;
  let duplicates = 0;
  let rejected = 0;

  for (const event of events) {
    const claim = await prisma.$transaction<ClaimedEvent>(async (tx) => {
      try {
        await tx.ingestedEvent.create({
          data: {
            connectionId: connection.id,
            provider: adapter.provider,
            externalId: event.externalId,
            signalId: null,
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) return { kind: "duplicate" };
        throw err;
      }

      // Coarse filter - record the event but create no Signal (no LLM cost).
      if (!adapter.shouldIngest(event, config)) {
        return { kind: "filtered" };
      }

      const signal = await tx.signal.create({
        data: {
          orgId: connection.orgId,
          connectionId: connection.id,
          source: adapter.provider as unknown as SignalSource,
          rawInput: asJson(adapter.toRawInput(event)),
          status: quotaBlocked ? "REJECTED" : "QUEUED",
          statusReason: quotaBlocked ? "Monthly quota reached" : null,
        },
      });
      await tx.ingestedEvent.update({
        where: {
          connectionId_externalId: {
            connectionId: connection.id,
            externalId: event.externalId,
          },
        },
        data: { signalId: signal.id },
      });

      return quotaBlocked
        ? { kind: "quota_rejected" }
        : { kind: "ingested", signalId: signal.id, externalId: event.externalId };
    });

    if (claim.kind === "duplicate") {
      duplicates += 1;
      continue;
    }
    if (claim.kind === "filtered") {
      filtered += 1;
      continue;
    }
    if (claim.kind === "quota_rejected") {
      // Signal persisted as REJECTED above; do not enqueue (no LLM cost).
      rejected += 1;
      continue;
    }

    try {
      await inngest.send({
        name: "signal/submitted",
        data: { signalId: claim.signalId },
      });
    } catch (err) {
      // No outbox table yet: remove the claim and signal so provider retry can recover.
      await prisma.$transaction([
        prisma.ingestedEvent.deleteMany({
          where: { connectionId: connection.id, externalId: claim.externalId },
        }),
        prisma.signal.deleteMany({ where: { id: claim.signalId } }),
      ]);
      return NextResponse.json(
        {
          error: "Queued signal could not be dispatched",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 503 },
      );
    }
    ingested += 1;
  }

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { lastEventAt: new Date() },
  });

  return NextResponse.json({ ok: true, ingested, filtered, duplicates, rejected });
}