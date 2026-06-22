"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/signal/status-badge";

type Row = {
  id: string;
  title: string;
  createdAt: string;
  significanceScore: number | null;
  costUsd: number;
  status: string;
};

export function SignalList({ signals }: { signals: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(signals);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(e: React.MouseEvent, id: string) {
    // Don't navigate into the signal when clicking the trash icon.
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        "Delete this signal and its generated assets? This can't be undone.",
      )
    )
      return;
    setBusyId(id);
    const res = await fetch(`/api/signals/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((r) => r.filter((x) => x.id !== id));
      router.refresh();
    }
    setBusyId(null);
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No signals yet. Submit your first one to see the pipeline run.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <div key={s.id} className="relative">
          <Link href={`/signals/${s.id}`} className="block">
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center justify-between gap-3 py-4 pr-12">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
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
          <button
            type="button"
            aria-label="Delete signal"
            title="Delete signal"
            disabled={busyId === s.id}
            onClick={(e) => remove(e, s.id)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
