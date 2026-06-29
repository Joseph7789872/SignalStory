import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext, requireOwner } from "@/lib/auth";

// GDPR/CCPA baseline: export all org data (GET) and permanently delete the org
// (DELETE, owner-only). Self-guards via auth (not in the middleware PROTECTED
// regex) so unauthenticated callers get JSON 401, not a redirect.
export const dynamic = "force-dynamic";

// GET — download the caller's entire organization as JSON (data access right).
export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = ctx.org.id;

  const [org, members, signals, memoryDocs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        profile: true,
        founder: true,
        brandVoice: true,
        editorial: true,
        subscription: true,
      },
    }),
    prisma.user.findMany({
      where: { orgId },
      select: { email: true, name: true, role: true, createdAt: true },
    }),
    prisma.signal.findMany({
      where: { orgId },
      include: { assets: true },
      orderBy: { createdAt: "desc" },
    }),
    // rawText + metadata; embeddings are an internal vector column and excluded.
    prisma.memoryDoc.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Connection signing secrets are intentionally NOT exported.
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      organization: org,
      members,
      signals,
      memoryDocs,
    },
    null,
    2,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="signalstory-export-${orgId}.json"`,
    },
  });
}

// DELETE — permanently remove the organization and all of its data. Cascades to
// every child record (schema onDelete: Cascade), including team members. The
// authentication identity itself is provider-managed; signing in again would
// provision a fresh, empty workspace.
export async function DELETE() {
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

  await prisma.organization.delete({ where: { id: ctx.org.id } });
  return NextResponse.json({ ok: true });
}
