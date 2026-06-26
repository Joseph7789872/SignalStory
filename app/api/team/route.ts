import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext, requireOwner } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const INVITE_TTL_DAYS = 14;

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = ctx.org.id;

  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { orgId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizationInvite.findMany({
      where: { orgId, status: "PENDING" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ members, invites, role: ctx.user.role });
}

const InviteInput = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).optional().default("MEMBER"),
});

export async function POST(req: Request) {
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

  const parsed = InviteInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { orgId: true },
  });
  if (existingUser?.orgId === ctx.org.id) {
    return NextResponse.json(
      { error: "That person is already a member" },
      { status: 409 },
    );
  }
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "That email already belongs to another workspace. Multi-workspace membership is not supported yet.",
      },
      { status: 409 },
    );
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const invite = await prisma.organizationInvite.create({
    data: { orgId: ctx.org.id, email, role: parsed.data.role, expiresAt },
  });

  // Best-effort invite email — sendEmail never throws and no-ops when Resend
  // is unconfigured, so delivery problems can't fail the invite.
  await sendEmail({
    to: email,
    ...inviteEmail({
      orgName: ctx.org.name,
      role: parsed.data.role,
      inviteToken: invite.token,
    }),
  });

  return NextResponse.json({ invite });
}

export async function DELETE(req: Request) {
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

  const url = new URL(req.url);
  const inviteId = url.searchParams.get("inviteId");
  const userId = url.searchParams.get("userId");

  if (inviteId) {
    await prisma.organizationInvite.updateMany({
      where: { id: inviteId, orgId: ctx.org.id },
      data: { status: "REVOKED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (userId) {
    if (userId === ctx.user.id) {
      return NextResponse.json(
        { error: "You can't remove yourself" },
        { status: 400 },
      );
    }
    // Scope to the caller's org; cascades the member's signals.
    await prisma.user.deleteMany({ where: { id: userId, orgId: ctx.org.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing inviteId or userId" }, { status: 400 });
}
