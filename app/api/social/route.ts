import { NextResponse } from "next/server";
import type { SocialProvider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAuthContext, requireOwner } from "@/lib/auth";
import { isLinkedInConfigured } from "@/lib/social/linkedin";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET — connected social accounts (never returns tokens).
export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accounts = await prisma.socialAccount.findMany({
    where: { orgId: ctx.org.id },
    select: { id: true, provider: true, status: true, displayName: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ accounts, linkedinConfigured: isLinkedInConfigured() });
}

// DELETE ?provider=LINKEDIN — disconnect (owner-only).
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
  const provider = new URL(req.url).searchParams.get("provider");
  if (provider !== "LINKEDIN") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  await prisma.socialAccount.deleteMany({
    where: { orgId: ctx.org.id, provider: provider as SocialProvider },
  });
  writeAudit({
    orgId: ctx.org.id,
    actor: ctx.user,
    action: "linkedin.disconnected",
    resourceType: "SocialAccount",
  });
  return NextResponse.json({ ok: true });
}
