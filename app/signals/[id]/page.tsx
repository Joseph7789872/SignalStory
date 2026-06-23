"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!signal) return <p className="text-destructive">Signal not found.</p>;

  const score = signal.scoreDetail;
  const angles = signal.storyAngles;
  const brief = signal.narrativeBrief;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {signal.rawInput?.title ?? "Signal"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {signal.costUsd > 0 && `Run cost $${signal.costUsd.toFixed(4)}`}
          </p>
        </div>
        <StatusBadge status={signal.status} />
      </div>

      {!isTerminalStatus(signal.status) && (
        <p className="text-sm text-muted-foreground">
          Pipeline running… this view updates automatically.
        </p>
      )}

      {signal.status === "REJECTED" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">Not worth publishing yet</CardTitle>
            <CardDescription className="text-amber-800">
              {signal.statusReason}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {signal.status === "FAILED" && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Failed</CardTitle>
            <CardDescription>{signal.statusReason}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Significance */}
      {score && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              Significance: {score.overall}/100
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(score.dimensions ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v as number}</span>
                </div>
              ))}
            </div>
            {score.reasons?.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {score.reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {score.missingInfo?.length > 0 && (
              <p className="text-muted-foreground">
                To strengthen: {score.missingInfo.join("; ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Story angles */}
      {angles?.angles?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Story angles</CardTitle>
            <CardDescription>Events aren’t content — stories are.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {angles.angles.map((a: any, i: number) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  i === angles.recommendedIndex ? "border-primary bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.title}</span>
                  <Badge variant="outline">{a.type}</Badge>
                  {i === angles.recommendedIndex && (
                    <Badge variant="success">recommended</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm">{a.thesis}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Narrative brief */}
      {brief && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Narrative brief</CardTitle>
            <CardDescription>The source of truth for all assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Thesis:</span> {brief.thesis}
            </p>
            <p>
              <span className="font-medium">Audience:</span> {brief.audience}
            </p>
            <p>
              <span className="font-medium">CTA:</span> {brief.cta}
            </p>
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
              <CardTitle className="text-base">Proof library</CardTitle>
              <CardDescription>
                Sources from your company knowledge used to ground this story.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                {proof.map((src) => (
                  <div key={src.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">
                        [{src.id}]
                      </span>
                      {src.sourceUrl ? (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {src.title}
                        </a>
                      ) : (
                        <span className="font-medium">{src.title}</span>
                      )}
                      <Badge variant="outline">
                        {src.kind.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {Math.round(src.score * 100)}% match
                      </span>
                    </div>
                    {src.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
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
                    <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg border p-3">
                      <span className="flex-1">{c.claim}</span>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        {c.sourceIds.map((sid) => (
                          <span
                            key={sid}
                            className="font-mono text-xs rounded bg-muted px-1.5 py-0.5"
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
