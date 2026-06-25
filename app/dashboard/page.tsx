import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contextCompleteness } from "@/lib/context/bundle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignalList } from "@/components/signal/signal-list";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  // Soft gate: route never-onboarded orgs into the guided wizard once. The
  // wizard's Skip/Finish set onboardedAt, so this redirect fires only once.
  if (!ctx.org.onboardedAt) redirect("/onboarding");

  const [signals, completeness] = await Promise.all([
    prisma.signal.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    contextCompleteness(ctx.org.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Signals</h1>
          <p className="text-sm text-muted-foreground">
            Submit a company signal and let the pipeline turn it into
            founder-quality content.
          </p>
        </div>
        <Button asChild>
          <Link href="/signals/new">New signal</Link>
        </Button>
      </div>

      {completeness < 60 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">
              Your context is {completeness}% complete
            </CardTitle>
            <CardDescription className="text-amber-800">
              Context is the moat. The more founder beliefs, brand voice, and
              editorial strategy you add, the less generic the output.{" "}
              <Link href="/context" className="font-medium underline">
                Complete it →
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
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
