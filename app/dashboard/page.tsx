import Link from "next/link";

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
import { StatusBadge } from "@/components/signal/status-badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
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

      {signals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No signals yet. Submit your first one to see the pipeline run.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {signals.map((s) => {
            const raw = s.rawInput as { title?: string };
            return (
              <Link key={s.id} href={`/signals/${s.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {raw?.title ?? "Untitled signal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                        {s.significanceScore !== null &&
                          ` · significance ${s.significanceScore}/100`}
                        {s.costUsd > 0 && ` · $${s.costUsd.toFixed(3)}`}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
