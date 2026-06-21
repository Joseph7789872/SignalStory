import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ReviewInput = z.object({
  decision: z.enum(["APPROVE", "EDIT", "REJECT"]),
  editedBody: z.unknown().optional(),
  notes: z.string().optional(),
});

const STATUS = {
  APPROVE: "APPROVED",
  EDIT: "EDITED",
  REJECT: "REJECTED",
} as const;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ReviewInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const asset = await prisma.contentAsset.findFirst({
    where: { id: params.id, signal: { orgId: ctx.org.id } },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { decision, editedBody, notes } = parsed.data;

  const updated = await prisma.contentAsset.update({
    where: { id: asset.id },
    data: {
      reviewStatus: STATUS[decision],
      ...(decision === "EDIT" && editedBody !== undefined
        ? { editedBody: editedBody as object }
        : {}),
    },
  });

  await prisma.feedback.create({
    data: {
      signalId: asset.signalId,
      assetId: asset.id,
      userId: ctx.user.id,
      decision,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ asset: updated });
}
