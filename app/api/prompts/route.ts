import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { AGENT_DEFAULTS } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = ctx.org.id;

  const templates = await prisma.promptTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Per-version performance (org-scoped): how many runs used a version, and the
  // human-feedback decisions on signals where that version ran. Approximate — a
  // signal's feedback reflects all of its agents — but enough to tune by hand.
  const runs = await prisma.agentRun.findMany({
    where: { signal: { orgId } },
    select: { promptVersion: true, signalId: true },
  });
  const feedback = await prisma.feedback.findMany({
    where: { signal: { orgId } },
    select: { signalId: true, decision: true },
  });
  const fbBySignal = new Map<string, string[]>();
  for (const f of feedback) {
    const arr = fbBySignal.get(f.signalId) ?? [];
    arr.push(f.decision);
    fbBySignal.set(f.signalId, arr);
  }
  const performance: Record<
    string,
    { runs: number; feedback: Record<string, number> }
  > = {};
  const seenSignalPerVersion = new Map<string, Set<string>>();
  for (const r of runs) {
    const perf = (performance[r.promptVersion] ??= { runs: 0, feedback: {} });
    perf.runs += 1;
    const seen = seenSignalPerVersion.get(r.promptVersion) ?? new Set();
    if (!seen.has(r.signalId)) {
      seen.add(r.signalId);
      for (const dec of fbBySignal.get(r.signalId) ?? []) {
        perf.feedback[dec] = (perf.feedback[dec] ?? 0) + 1;
      }
    }
    seenSignalPerVersion.set(r.promptVersion, seen);
  }

  const agents = AGENT_DEFAULTS.map((d) => {
    const versions = templates.filter((t) => t.agent === d.agent);
    const active = versions.find((v) => v.isActive);
    return {
      agent: d.agent,
      label: d.label,
      defaultVersion: d.version,
      defaultInstruction: d.instruction,
      activeVersion: active?.version ?? d.version,
      usingDefault: !active,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        isActive: v.isActive,
        instruction: v.instruction,
        createdAt: v.createdAt,
      })),
    };
  });

  return NextResponse.json({ agents, performance });
}

const CreateInput = z.object({
  agent: z.string().min(1),
  version: z.string().min(1),
  instruction: z.string().min(10),
  activate: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { agent, version, instruction, activate } = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    if (activate) {
      await tx.promptTemplate.updateMany({
        where: { agent },
        data: { isActive: false },
      });
    }
    return tx.promptTemplate.create({
      data: { agent, version, instruction, isActive: activate },
    });
  });

  return NextResponse.json({ template: created });
}

const ActivateInput = z.object({
  agent: z.string().min(1),
  version: z.string().min(1),
});

export async function PUT(req: Request) {
  try {
    await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ActivateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { agent, version } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.promptTemplate.updateMany({
      where: { agent },
      data: { isActive: false },
    });
    await tx.promptTemplate.updateMany({
      where: { agent, version },
      data: { isActive: true },
    });
  });

  return NextResponse.json({ ok: true });
}
