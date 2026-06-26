import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET ?from&to — the org's scheduled posts (with the source signal's title).
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return unauthorized();
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const scheduledFor =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }
      : undefined;

  const rows = await prisma.scheduledPost.findMany({
    where: { orgId: ctx.org.id, ...(scheduledFor ? { scheduledFor } : {}) },
    orderBy: { scheduledFor: "asc" },
    include: {
      asset: { select: { signalId: true, signal: { select: { rawInput: true } } } },
    },
  });

  const posts = rows.map((r) => ({
    id: r.id,
    assetId: r.assetId,
    signalId: r.asset.signalId,
    channel: r.channel,
    scheduledFor: r.scheduledFor,
    status: r.status,
    note: r.note,
    postedAt: r.postedAt,
    title: (r.asset.signal?.rawInput as { title?: string } | null)?.title ?? "Signal",
  }));

  return NextResponse.json({ posts });
}

const CreateInput = z.object({
  assetId: z.string().min(1),
  scheduledFor: z.string().datetime(),
  note: z.string().max(2000).optional(),
});

// POST { assetId, scheduledFor, note? } — schedule an asset (org-scoped).
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return unauthorized();
  }

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify the asset belongs to the caller's org (asset → signal.orgId).
  const asset = await prisma.contentAsset.findFirst({
    where: { id: parsed.data.assetId, signal: { orgId: ctx.org.id } },
    select: { id: true, channel: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const post = await prisma.scheduledPost.create({
    data: {
      orgId: ctx.org.id,
      assetId: asset.id,
      channel: asset.channel,
      scheduledFor: new Date(parsed.data.scheduledFor),
      note: parsed.data.note,
      createdById: ctx.user.id,
    },
  });

  return NextResponse.json({ post });
}

const PatchInput = z.object({
  id: z.string().min(1),
  status: z.enum(["SCHEDULED", "POSTED", "CANCELED"]).optional(),
  scheduledFor: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
});

// PATCH { id, status?|scheduledFor?|note? } — update status / reschedule.
export async function PATCH(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return unauthorized();
  }

  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, status, scheduledFor, note } = parsed.data;

  const result = await prisma.scheduledPost.updateMany({
    where: { id, orgId: ctx.org.id },
    data: {
      ...(status ? { status } : {}),
      ...(status === "POSTED" ? { postedAt: new Date() } : {}),
      ...(scheduledFor ? { scheduledFor: new Date(scheduledFor) } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE ?id — remove a scheduled post (org-scoped).
export async function DELETE(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return unauthorized();
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await prisma.scheduledPost.deleteMany({ where: { id, orgId: ctx.org.id } });
  return NextResponse.json({ ok: true });
}
