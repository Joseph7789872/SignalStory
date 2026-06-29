import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Plus, Radio } from "lucide-react";

import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contextCompleteness } from "@/lib/context/bundle";
import { Button } from "@/components/ui/button";
import { SignalList } from "@/components/signal/signal-list";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set([
  "QUEUED",
  "NORMALIZING",
  "SCORING",
  "STORY",
  "NARRATIVE",
  "CHANNEL",
  "EDITING",
]);

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  // Soft gate: route never-onboarded orgs into the guided wizard once. The
  // wizard's Skip/Finish set onboardedAt, so this redirect fires only once.
  if (!ctx.org.onboardedAt) redirect("/onboarding");

  const [signals, completeness] = await Promise.all([
    prisma.signal.findMany({
      where: { orgId: ctx.org.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    contextCompleteness(ctx.org.id),
  ]);

  const total = signals.length;
  const ready = signals.filter((s) => s.status === "READY").length;
  const inProgress = signals.filter((s) => ACTIVE_STATUSES.has(s.status)).length;

  const stats = [
    { label: "Total signals", value: total, icon: Radio, tone: "muted" as const },
    { label: "Ready", value: ready, icon: CheckCircle2, tone: "success" as const },
    { label: "In progress", value: inProgress, icon: Loader2, tone: "brand" as const },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Signals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a company signal and let the pipeline turn it into
            founder-quality content.
          </p>
        </div>
        <Button asChild>
          <Link href="/signals/new">
            <Plus className="h-4 w-4" />
            New signal
          </Link>
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                  stat.tone === "success"
                    ? "bg-success/10 text-success"
                    : stat.tone === "brand"
                      ? "bg-brand/10 text-brand"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {completeness < 60 && (
        <Link
          href="/context"
          className="group flex items-center justify-between gap-4 rounded-xl border border-warning/40 bg-warning/10 p-5 transition-colors hover:bg-warning/15"
        >
          <div>
            <p className="font-semibold">
              Your context is {completeness}% complete
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Context is the moat. The more founder beliefs, brand voice, and
              editorial strategy you add, the less generic the output.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
            Complete it
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <SignalList
        signals={signals.map((s) => ({
          id: s.id,
          title: (s.rawInput as { title?: string })?.title ?? "Untitled signal",
          createdAt: s.createdAt.toISOString(),
          significanceScore: s.significanceScore,
          costUsd: s.costUsd,
          status: s.status,
          source: s.source,
        }))}
      />
    </div>
  );
}
