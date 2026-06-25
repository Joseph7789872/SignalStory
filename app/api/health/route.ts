import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness + dependency check for uptime monitors. Returns 503 when the
// database is unreachable so an external monitor can alert.
export async function GET() {
  let db: "ok" | "down" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }

  const healthy = db === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", service: "signalstory", db },
    { status: healthy ? 200 : 503 },
  );
}
