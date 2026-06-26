import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Marks the org as having completed (or skipped) guided onboarding, which stops
// the dashboard soft-gate redirect. Idempotent.
export async function POST() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.organization.update({
    where: { id: ctx.org.id },
    data: { onboardedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
