import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET ?action= — org's audit log (owner-only), newest first.
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Owners only" : "Unauthorized" },
      { status: forbidden ? 403 : 401 },
    );
  }
  const action = new URL(req.url).searchParams.get("action") ?? undefined;

  const logs = await prisma.auditLog.findMany({
    where: { orgId: ctx.org.id, ...(action ? { action: { contains: action } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      actorEmail: true,
      resourceType: true,
      resourceId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
