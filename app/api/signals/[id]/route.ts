import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signal = await prisma.signal.findFirst({
    where: { id: params.id, orgId: ctx.org.id, deletedAt: null },
    include: {
      assets: { orderBy: { channel: "asc" } },
      runs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!signal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ signal });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Soft delete (recoverable from Trash). Scoped to the caller's org.
  const res = await prisma.signal.updateMany({
    where: { id: params.id, orgId: ctx.org.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  writeAudit({
    orgId: ctx.org.id,
    actor: ctx.user,
    action: "signal.deleted",
    resourceType: "Signal",
    resourceId: params.id,
  });
  return NextResponse.json({ ok: true });
}
