import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { AGENT_DEFAULTS } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

function ownerError(e: unknown) {
  const forbidden = e instanceof Error && e.message === "FORBIDDEN";
  return NextResponse.json(
    { error: forbidden ? "Owners only" : "Unauthorized" },
    { status: forbidden ? 403 : 401 },
  );
}

export async function GET() {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const orgId = ctx.org.id;

  const templates = await prisma.promptTemplate.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  // Per-version performance (org-scoped): how many runs used a version, and the
  // human-feedback decisions on signals where that version ran. Approximate - a
  // signal's feedback reflects all of its agents - but enough to tune by hand.
  // Counts are aggregated DB-side (groupBy distinct version×signal pairs) rather
  // than materializing every AgentRun row, which grows unboundedly per org.
  const runGroups = await prisma.agentRun.groupBy({
    by: ["promptVersion", "signalId"],
    where: { signal: { orgId } },
    _count: { _all: true },
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
  // groupBy already yields one row per distinct (version, signalId), so each
  // signal is counted once per version for feedback — no manual dedup needed.
  for (const g of runGroups) {
    const perf = (performance[g.promptVersion] ??= { runs: 0, feedback: {} });
    perf.runs += g._count._all;
    if (!g.signalId) continue;
    for (const dec of fbBySignal.get(g.signalId) ?? []) {
      perf.feedback[dec] = (perf.feedback[dec] ?? 0) + 1;
    }
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

const AGENT_VALUES = AGENT_DEFAULTS.map((d) => d.agent) as [string, ...string[]];

const CreateInput = z.object({
  agent: z.enum(AGENT_VALUES),
  version: z.string().min(1).max(80),
  instruction: z.string().min(10).max(40_000),
  activate: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { agent, version, instruction, activate } = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.promptTemplate.updateMany({
          where: { orgId: ctx.org.id, agent },
          data: { isActive: false },
        });
      }
      return tx.promptTemplate.create({
        data: { orgId: ctx.org.id, agent, version, instruction, isActive: activate },
      });
    });

    return NextResponse.json({ template: created });
  } catch (e) {
    return NextResponse.json(
      { error: "Prompt version already exists for this workspace" },
      { status: 409 },
    );
  }
}

const ActivateInput = z.object({
  agent: z.enum(AGENT_VALUES),
  version: z.string().min(1).max(80),
});

export async function PUT(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }

  const parsed = ActivateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { agent, version } = parsed.data;

  const target = await prisma.promptTemplate.findFirst({
    where: { orgId: ctx.org.id, agent, version },
  });
  if (!target) {
    return NextResponse.json({ error: "Prompt version not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.promptTemplate.updateMany({
      where: { orgId: ctx.org.id, agent },
      data: { isActive: false },
    });
    await tx.promptTemplate.update({
      where: { id: target.id },
      data: { isActive: true },
    });
  });

  return NextResponse.json({ ok: true });
}