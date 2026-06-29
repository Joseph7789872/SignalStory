"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Compass,
  FileText,
  Gauge,
  Loader2,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, isTerminalStatus } from "@/components/signal/status-badge";
import { AssetCard } from "@/components/signal/asset-card";

type ProofSource = {
  id: string;
  chunkId: string;
  docId: string;
  title: string;
  sourceUrl: string | null;
  kind: string;
  excerpt: string;
  score: number;
};

type CitedClaim = {
  claim: string;
  sourceIds: string[];
  supported: boolean;
};

type Signal = {
  id: string;
  status: string;
  statusReason: string | null;
  significanceScore: number | null;
  scoreDetail: any;
  storyAngles: any;
  narrativeBrief: any;
  retrievedProof: any;
  costUsd: number;
  rawInput: any;
  assets: any[];
};

export default function SignalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/signals/${params.id}`, { cache: "no-store" });
    if (res.ok) {
      const { signal } = await res.json();
      setSignal(signal);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the pipeline is still running.
  useEffect(() => {
    if (!signal || isTerminalStatus(signal.status)) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [signal, load]);

  if (loading) return <SignalSkeleton />;
  if (!signal)
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <XCircle className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Signal not found.</p>
          <Link href="/dashboard" className="text-sm text-brand hover:underline">
            Back to signals
          </Link>
        </CardContent>
      </Card>
    );

  const score = signal.scoreDetail;
  const angles = signal.storyAngles;
  const brief = signal.narrativeBrief;
  const running = !isTerminalStatus(signal.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to signals
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {signal.rawInput?.title ?? "Signal"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {signal.significanceScore !== null && (
                <Badge variant="outline">
                  Significance {signal.significanceScore}/100
                </Badge>
              )}
              {signal.costUsd > 0 && (
                <span className="tabular-nums">
                  Run cost ${signal.costUsd.toFixed(4)}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={signal.status} />
        </div>
      </div>

      {/* Running banner */}
      {running && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
          <span className="text-muted-foreground">
            Pipeline running — this view updates automatically.
          </span>
        </div>
      )}

      {/* Rejected */}
      {signal.status === "REJECTED" && (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Not worth publishing yet
            </CardTitle>
            <CardDescription className="text-foreground/70">
              {signal.statusReason}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Failed */}
      {signal.status === "FAILED" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <XCircle className="h-4 w-4" />
              Failed
            </CardTitle>
            <CardDescription>{signal.statusReason}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Significance */}
      {score && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-brand" />
              Significance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums">
                  {score.overall}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Badge
                variant={
                  score.recommendation === "PUBLISH"
                    ? "success"
                    : score.recommendation === "MAYBE"
                      ? "warning"
                      : "secondary"
                }
              >
                {score.recommendation}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(score.dimensions ?? {}).map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className="font-semibold tabular-nums">
                      {v as number}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, v as number)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {score.reasons?.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {score.reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {score.missingInfo?.length > 0 && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground">
                <span className="font-medium text-foreground">To strengthen:</span>{" "}
                {score.missingInfo.join("; ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Story angles */}
      {angles?.angles?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-brand" />
              Story angles
            </CardTitle>
            <CardDescription>Events aren’t content — stories are.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {angles.angles.map((a: any, i: number) => (
              <div
                key={i}
                className={`rounded-lg border p-4 ${
                  i === angles.recommendedIndex
                    ? "border-brand/40 bg-brand/5 ring-1 ring-brand/15"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.title}</span>
                  <Badge variant="outline">{a.type}</Badge>
                  {i === angles.recommendedIndex && (
                    <Badge variant="success">recommended</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{a.thesis}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Narrative brief */}
      {brief && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand" />
              Narrative brief
            </CardTitle>
            <CardDescription>The source of truth for all assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              ["Thesis", brief.thesis],
              ["Audience", brief.audience],
              ["CTA", brief.cta],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
                  <span className="font-medium text-muted-foreground">{label}</span>
                  <span>{value as string}</span>
                </div>
              ) : null,
            )}
          </CardContent>
        </Card>
      )}

      {/* Proof library */}
      {Array.isArray(signal.retrievedProof) && signal.retrievedProof.length > 0 && (() => {
        const proof = signal.retrievedProof as ProofSource[];
        const claims: CitedClaim[] = Array.isArray(brief?.citedClaims) ? brief.citedClaims : [];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-brand" />
                Proof library
              </CardTitle>
              <CardDescription>
                Sources from your company knowledge used to ground this story.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                {proof.map((src) => (
                  <div key={src.id} className="space-y-1 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-xs text-brand">
                        [{src.id}]
                      </span>
                      {src.sourceUrl ? (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-brand hover:underline"
                        >
                          {src.title}
                        </a>
                      ) : (
                        <span className="font-medium">{src.title}</span>
                      )}
                      <Badge variant="outline">
                        {src.kind.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(src.score * 100)}% match
                      </span>
                    </div>
                    {src.excerpt && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {src.excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {claims.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Cited claims</p>
                  {claims.map((c, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-start gap-2 rounded-lg border p-3"
                    >
                      <span className="flex-1">{c.claim}</span>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        {c.sourceIds.map((sid) => (
                          <span
                            key={sid}
                            className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-xs text-brand"
                          >
                            [{sid}]
                          </span>
                        ))}
                        {!c.supported && (
                          <Badge variant="destructive" className="text-xs">
                            unsupported
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Assets */}
      {signal.assets?.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Content</h2>
          {signal.assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
