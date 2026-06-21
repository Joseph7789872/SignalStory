"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Analytics = {
  totals: {
    signals: number;
    totalCostUsd: number;
    costPerSignal: number;
    llmCalls: number;
    cacheHitPct: number;
    gateRejectionPct: number;
    avgAntiSlop: number;
    antiSlopPassPct: number;
  };
  byAgent: {
    agent: string;
    costUsd: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  }[];
  signalStatus: { status: string; count: number }[];
  assetReview: { status: string; count: number }[];
  feedback: { decision: string; count: number }[];
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; value: number; display: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      )}
      {rows.map((r) => (
        <div key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span>{r.label}</span>
            <span className="text-muted-foreground">{r.display}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-destructive">Failed to load analytics.</p>;

  const t = data.totals;
  const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
  const pct = (n: number) => `${n.toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Signals" value={String(t.signals)} />
        <Stat label="Total spend" value={usd(t.totalCostUsd)} />
        <Stat label="Cost / signal" value={usd(t.costPerSignal)} />
        <Stat label="LLM calls" value={String(t.llmCalls)} />
        <Stat label="Cache hit" value={pct(t.cacheHitPct)} />
        <Stat label="Gate rejection" value={pct(t.gateRejectionPct)} />
        <Stat label="Avg anti-slop" value={t.avgAntiSlop.toFixed(0)} />
        <Stat label="Anti-slop pass" value={pct(t.antiSlopPassPct)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost by agent</CardTitle>
        </CardHeader>
        <CardContent>
          <Bars
            rows={data.byAgent.map((a) => ({
              label: a.agent,
              value: a.costUsd,
              display: `${usd(a.costUsd)} · ${a.calls} calls`,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signals by status</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars
              rows={data.signalStatus.map((s) => ({
                label: s.status,
                value: s.count,
                display: String(s.count),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assets by review status</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars
              rows={data.assetReview.map((a) => ({
                label: a.status,
                value: a.count,
                display: String(a.count),
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Human feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <Bars
            rows={data.feedback.map((f) => ({
              label: f.decision,
              value: f.count,
              display: String(f.count),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
