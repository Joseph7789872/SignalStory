import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function ownerError(e: unknown) {
  const forbidden = e instanceof Error && e.message === "FORBIDDEN";
  return NextResponse.json(
    { error: forbidden ? "Owners only" : "Unauthorized" },
    { status: forbidden ? 403 : 401 },
  );
}

// GET — soft-deleted Signals + MemoryDocs for the org.
export async function GET() {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const orgId = ctx.org.id;

  const [signals, docs] = await Promise.all([
    prisma.signal.findMany({
      where: { orgId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: { id: true, rawInput: true, deletedAt: true },
    }),
    prisma.memoryDoc.findMany({
      where: { orgId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: { id: true, title: true, kind: true, deletedAt: true },
    }),
  ]);

  return NextResponse.json({
    signals: signals.map((s) => ({
      id: s.id,
      title: (s.rawInput as { title?: string } | null)?.title ?? "Signal",
      deletedAt: s.deletedAt,
    })),
    docs: docs.map((d) => ({ id: d.id, title: d.title, kind: d.kind, deletedAt: d.deletedAt })),
  });
}

const Body = z.object({
  resourceType: z.enum(["Signal", "MemoryDoc"]),
  id: z.string().min(1),
});

// POST — restore (deletedAt = null).
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { resourceType, id } = parsed.data;
  const where = { id, orgId: ctx.org.id, deletedAt: { not: null } };

  const count =
    resourceType === "Signal"
      ? (await prisma.signal.updateMany({ where, data: { deletedAt: null } })).count
      : (await prisma.memoryDoc.updateMany({ where, data: { deletedAt: null } })).count;
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  writeAudit({
    orgId: ctx.org.id,
    actor: ctx.user,
    action: `${resourceType.toLowerCase()}.restored`,
    resourceType,
    resourceId: id,
  });
  return NextResponse.json({ ok: true });
}

// DELETE — purge permanently (cascades children).
export async function DELETE(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { resourceType, id } = parsed.data;
  const where = { id, orgId: ctx.org.id, deletedAt: { not: null } };

  const count =
    resourceType === "Signal"
      ? (await prisma.signal.deleteMany({ where })).count
      : (await prisma.memoryDoc.deleteMany({ where })).count;
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  writeAudit({
    orgId: ctx.org.id,
    actor: ctx.user,
    action: `${resourceType.toLowerCase()}.purged`,
    resourceType,
    resourceId: id,
  });
  return NextResponse.json({ ok: true });
}
