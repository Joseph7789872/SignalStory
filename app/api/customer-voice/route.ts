import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EntryInput = z.object({
  kind: z.enum([
    "discovery_call",
    "objection",
    "testimonial",
    "review",
    "churn",
    "support",
    "other",
  ]),
  text: z.string().min(3).max(5_000),
  source: z.string().max(500).optional().default(""),
});

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.customerVoiceEntry.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = EntryInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const entry = await prisma.customerVoiceEntry.create({
    data: { orgId: ctx.org.id, ...parsed.data },
  });
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Scope the delete to the caller's org.
  await prisma.customerVoiceEntry.deleteMany({
    where: { id, orgId: ctx.org.id },
  });
  return NextResponse.json({ ok: true });
}