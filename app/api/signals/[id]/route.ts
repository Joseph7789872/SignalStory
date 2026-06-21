import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signal = await prisma.signal.findFirst({
    where: { id: params.id, orgId: ctx.org.id },
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
