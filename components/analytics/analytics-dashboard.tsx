"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/analytics/sparkline";

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

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const pct = (n: number) => `${n.toFixed(0)}%`;

type Funnel = {
  funnel: { generated: number; reviewed: number; approved: number; scheduled: number; posted: number };
  rates: { approvalRate: number; scheduleRate: number; postRate: number };
  byChannel: { channel: string; generated: number; approved: number; scheduled: number; posted: number }[];
  qualityTrend: { key: string; avgAntiSlop: number; count: number }[];
  bucket: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN_FOUNDER: "LinkedIn",
  X_THREAD: "X thread",
  BLOG_POST: "Blog post",
};

function ContentTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const res = await fetch(`/api/analytics/funnel?from=${from}&bucket=week`, { cache: "no-store" });
    setData(res.ok ? await res.json() : null);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant={d === days ? "default" : "outline"} onClick={() => setDays(d)}>
            {d}d
          </Button>
        ))}
      </div>

      {loading || !data ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Bars
                rows={[
                  { label: "Generated", value: data.funnel.generated, display: String(data.funnel.generated) },
                  { label: "Reviewed", value: data.funnel.reviewed, display: String(data.funnel.reviewed) },
                  { label: "Approved", value: data.funnel.approved, display: String(data.funnel.approved) },
                  { label: "Scheduled", value: data.funnel.scheduled, display: String(data.funnel.scheduled) },
                  { label: "Posted", value: data.funnel.posted, display: String(data.funnel.posted) },
                ]}
              />
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Approval rate" value={pct(data.rates.approvalRate)} />
                <Stat label="Schedule rate" value={pct(data.rates.scheduleRate)} />
                <Stat label="Post rate" value={pct(data.rates.postRate)} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approved by channel</CardTitle>
              </CardHeader>
              <CardContent>
                <Bars
                  rows={data.byChannel.map((c) => ({
                    label: CHANNEL_LABEL[c.channel] ?? c.channel,
                    value: c.approved,
                    display: `${c.approved}/${c.generated} · ${c.posted} posted`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anti-slop trend (weekly avg)</CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline
                  points={data.qualityTrend.map((b) => b.avgAntiSlop)}
                  labels={data.qualityTrend.map((b) => b.key)}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function PipelineTab({ data }: { data: Analytics }) {
  const t = data.totals;
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

  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">Content performance</TabsTrigger>
        <TabsTrigger value="pipeline">Pipeline cost &amp; quality</TabsTrigger>
      </TabsList>
      <TabsContent value="content">
        <ContentTab />
      </TabsContent>
      <TabsContent value="pipeline">
        <PipelineTab data={data} />
      </TabsContent>
    </Tabs>
  );
}
