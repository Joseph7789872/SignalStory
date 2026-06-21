import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

const SignalInput = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  evidence: z.string().optional().default(""),
  links: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = SignalInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const signal = await prisma.signal.create({
    data: {
      orgId: ctx.org.id,
      userId: ctx.user.id,
      source: "MANUAL",
      rawInput: parsed.data,
      status: "QUEUED",
    },
  });

  // Durable: enqueue to Inngest. The run-pipeline function executes each agent
  // stage as a retryable/resumable step (see lib/inngest/functions.ts). If the
  // queue is unreachable (e.g. the Inngest dev server isn't running locally),
  // keep the signal QUEUED and surface why instead of 500-ing the request.
  try {
    await inngest.send({
      name: "signal/submitted",
      data: { signalId: signal.id },
    });
  } catch (err) {
    await prisma.signal.update({
      where: { id: signal.id },
      data: {
        statusReason:
          "Queued but not yet picked up — is the job queue running? " +
          (err instanceof Error ? err.message : String(err)),
      },
    });
  }

  return NextResponse.json({ id: signal.id, status: signal.status });
}

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signals = await prisma.signal.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      statusReason: true,
      significanceScore: true,
      rawInput: true,
      costUsd: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ signals });
}
