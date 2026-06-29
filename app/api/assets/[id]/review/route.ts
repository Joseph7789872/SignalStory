import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { CHANNEL_SCHEMA } from "@/lib/agents/schemas";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ReviewInput = z.object({
  decision: z.enum(["APPROVE", "EDIT", "REJECT"]),
  editedBody: z.unknown().optional(),
  notes: z.string().max(2_000).optional(),
});

const STATUS = {
  APPROVE: "APPROVED",
  EDIT: "EDITED",
  REJECT: "REJECTED",
} as const;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  let validatedEdit: unknown = editedBody;
  if (decision === "EDIT") {
    const schema = CHANNEL_SCHEMA[asset.channel];
    const edit = schema.safeParse(editedBody);
    if (!edit.success) {
      return NextResponse.json(
        { error: "Invalid edited body", details: edit.error.flatten() },
        { status: 400 },
      );
    }
    validatedEdit = edit.data;
  }

  const updated = await prisma.contentAsset.update({
    where: { id: asset.id },
    data: {
      reviewStatus: STATUS[decision],
      ...(decision === "EDIT" ? { editedBody: validatedEdit as object } : {}),
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
  writeAudit({
    orgId: ctx.org.id,
    actor: ctx.user,
    action: `asset.${decision.toLowerCase()}`,
    resourceType: "ContentAsset",
    resourceId: asset.id,
    metadata: { channel: asset.channel },
  });

  return NextResponse.json({ asset: updated });
}