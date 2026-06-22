import { NextResponse } from "next/server";
import type { Prisma, SignalSource } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import { decryptSecret } from "@/lib/crypto";
import { inngest } from "@/lib/inngest/client";
import type { ConnectionConfig, ProviderEvent } from "@/lib/integrations/types";

// Public (NOT auth-gated): third parties POST here with no Supabase session.
// Authenticated instead by the unguessable token + the provider signature.
export const dynamic = "force-dynamic";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

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

  // Read the RAW body (needed for signature verification) + lowercased headers.
  const rawBody = await req.text();
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
  } catch {
    events = [];
  }

  let ingested = 0;
  for (const event of events) {
    // Dedup — providers retry; never create the same Signal twice. Scoped per
    // connection so user-supplied ids (generic webhook) can't collide across orgs.
    const seen = await prisma.ingestedEvent.findUnique({
      where: {
        connectionId_externalId: {
          connectionId: connection.id,
          externalId: event.externalId,
        },
      },
    });
    if (seen) continue;

    // Coarse filter — record the event but create no Signal (no LLM cost).
    if (!adapter.shouldIngest(event, config)) {
      await prisma.ingestedEvent.create({
        data: {
          connectionId: connection.id,
          provider: adapter.provider,
          externalId: event.externalId,
          signalId: null,
        },
      });
      continue;
    }

    const signal = await prisma.signal.create({
      data: {
        orgId: connection.orgId,
        connectionId: connection.id,
        source: adapter.provider as unknown as SignalSource,
        rawInput: asJson(adapter.toRawInput(event)),
        status: "QUEUED",
      },
    });
    await prisma.ingestedEvent.create({
      data: {
        connectionId: connection.id,
        provider: adapter.provider,
        externalId: event.externalId,
        signalId: signal.id,
      },
    });

    // Same trigger as a manual submission — the pipeline is unchanged.
    try {
      await inngest.send({
        name: "signal/submitted",
        data: { signalId: signal.id },
      });
    } catch (err) {
      await prisma.signal.update({
        where: { id: signal.id },
        data: {
          statusReason:
            "Queued but not picked up — is the job queue running? " +
            (err instanceof Error ? err.message : String(err)),
        },
      });
    }
    ingested += 1;
  }

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { lastEventAt: new Date() },
  });

  return NextResponse.json({ ok: true, ingested });
}
