import { NextResponse } from "next/server";
import { z } from "zod";
import type { IntegrationProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAuthContext, requireOwner } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getAdapterByProvider, PROVIDERS } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

function ownerError(e: unknown) {
  const forbidden = e instanceof Error && e.message === "FORBIDDEN";
  return NextResponse.json(
    { error: forbidden ? "Owners only" : "Unauthorized" },
    { status: forbidden ? 403 : 401 },
  );
}

const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.integrationConnection.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    role: ctx.user.role,
    providers: PROVIDERS, // available adapters + their selectable events
    connections: connections.map((c) => {
      const adapter = getAdapterByProvider(c.provider);
      return {
        id: c.id,
        provider: c.provider,
        label: c.label,
        status: c.status,
        config: c.config,
        lastEventAt: c.lastEventAt,
        createdAt: c.createdAt,
        // Never return the secret; show the webhook URL to paste into the provider.
        webhookUrl: adapter
          ? `${base}/api/webhooks/${adapter.slug}/${c.webhookToken}`
          : null,
      };
    }),
  });
}

const CreateInput = z.object({
  provider: z.enum(["STRIPE", "GITHUB"]),
  label: z.string().optional().default(""),
  secret: z.string().min(8),
  config: z
    .object({
      events: z.array(z.string()).optional(),
      minAmountUsd: z.number().optional(),
    })
    .optional()
    .default({}),
});

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { provider, label, secret, config } = parsed.data;

  const conn = await prisma.integrationConnection.create({
    data: {
      orgId: ctx.org.id,
      provider: provider as IntegrationProvider,
      label,
      secret: encryptSecret(secret),
      config,
      createdById: ctx.user.id,
    },
  });
  const adapter = getAdapterByProvider(provider);

  return NextResponse.json({
    id: conn.id,
    webhookUrl: adapter ? `${base}/api/webhooks/${adapter.slug}/${conn.webhookToken}` : null,
  });
}

const PatchInput = z.object({
  id: z.string(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  config: z
    .object({
      events: z.array(z.string()).optional(),
      minAmountUsd: z.number().optional(),
    })
    .optional(),
});

export async function PATCH(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }

  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, status, config } = parsed.data;

  await prisma.integrationConnection.updateMany({
    where: { id, orgId: ctx.org.id },
    data: {
      ...(status ? { status } : {}),
      ...(config ? { config } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.integrationConnection.deleteMany({
    where: { id, orgId: ctx.org.id },
  });
  return NextResponse.json({ ok: true });
}
