"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/signal/status-badge";

type Row = {
  id: string;
  title: string;
  createdAt: string;
  significanceScore: number | null;
  costUsd: number;
  status: string;
  source: string;
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  GITHUB: "GitHub",
  PIPEDRIVE: "Pipedrive",
  ATTIO: "Attio",
  LINEAR: "Linear",
  WEBHOOK: "Webhook",
};

export function SignalList({ signals }: { signals: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(signals);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hideAutoRejected, setHideAutoRejected] = useState(true);

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
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radio className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold">No signals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit your first one to see the context-first pipeline run.
            </p>
          </div>
          <Button asChild>
            <Link href="/signals/new">
              <Plus className="h-4 w-4" />
              New signal
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Auto-ingested signals the significance gate rejected are noise — hide by default.
  const isAutoRejected = (r: Row) => r.source !== "MANUAL" && r.status === "REJECTED";
  const autoRejectedCount = rows.filter(isAutoRejected).length;
  const visible = hideAutoRejected ? rows.filter((r) => !isAutoRejected(r)) : rows;

  return (
    <div className="space-y-3">
      {autoRejectedCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideAutoRejected}
            onChange={(e) => setHideAutoRejected(e.target.checked)}
          />
          Hide auto-ingested signals the gate rejected ({autoRejectedCount})
        </label>
      )}
      {visible.map((s) => (
        <div key={s.id} className="group relative">
          <Link href={`/signals/${s.id}`} className="block">
            <Card className="transition-all hover:border-brand/40 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-3 py-4 pl-5 pr-12">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                    {s.significanceScore !== null &&
                      ` · significance ${s.significanceScore}/100`}
                    {s.costUsd > 0 && ` · $${s.costUsd.toFixed(3)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.source !== "MANUAL" && (
                    <Badge variant="outline">
                      {SOURCE_LABEL[s.source] ?? s.source}
                    </Badge>
                  )}
                  <StatusBadge status={s.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <button
            type="button"
            aria-label="Delete signal"
            title="Delete signal"
            disabled={busyId === s.id}
            onClick={(e) => remove(e, s.id)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
