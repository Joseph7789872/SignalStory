"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN_FOUNDER: "LinkedIn — founder post",
  X_THREAD: "X thread",
  BLOG_POST: "Blog post",
};

const REVIEW_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline"
> = {
  PENDING: "secondary",
  APPROVED: "success",
  EDITED: "default",
  REJECTED: "destructive",
  NEEDS_WORK: "warning",
};

function Body({ channel, body }: { channel: string; body: any }) {
  if (!body) return null;
  if (channel === "LINKEDIN_FOUNDER") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">{body.hook}</p>
        <p className="whitespace-pre-wrap">{body.body}</p>
        <p className="italic text-muted-foreground">{body.takeaway}</p>
        {body.hashtags?.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {body.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}
          </p>
        )}
      </div>
    );
  }
  if (channel === "X_THREAD") {
    return (
      <ol className="space-y-2 text-sm">
        {body.tweets?.map((t: string, i: number) => (
          <li key={i} className="rounded border p-2">
            {t}
          </li>
        ))}
      </ol>
    );
  }
  if (channel === "BLOG_POST") {
    return (
      <div className="space-y-3 text-sm">
        {/* SEO/GEO metadata */}
        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          <p className="font-medium">SEO / GEO</p>
          <p>
            <span className="text-muted-foreground">Title:</span> {body.seoTitle}
          </p>
          <p>
            <span className="text-muted-foreground">Meta:</span>{" "}
            {body.metaDescription}
          </p>
          <p>
            <span className="text-muted-foreground">Slug:</span>{" "}
            <code>/{body.slug}</code>
          </p>
          <p>
            <span className="text-muted-foreground">Primary keyword:</span>{" "}
            {body.primaryKeyword}
          </p>
          {body.secondaryKeywords?.length > 0 && (
            <p>
              <span className="text-muted-foreground">Secondary:</span>{" "}
              {body.secondaryKeywords.join(", ")}
            </p>
          )}
          {body.wordCount != null && (
            <p>
              <span className="text-muted-foreground">Words:</span> ~
              {body.wordCount}
            </p>
          )}
        </div>

        {body.h1 && <p className="text-base font-semibold">{body.h1}</p>}
        {body.tldr && (
          <p className="rounded bg-muted p-2 italic text-muted-foreground">
            TL;DR: {body.tldr}
          </p>
        )}
        {body.bodyMarkdown && (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {body.bodyMarkdown}
          </pre>
        )}

        {body.keyTakeaways?.length > 0 && (
          <div>
            <p className="font-medium">Key takeaways</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {body.keyTakeaways.map((t: string, i: number) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {body.faq?.length > 0 && (
          <div>
            <p className="font-medium">FAQ</p>
            <div className="space-y-1">
              {body.faq.map((f: any, i: number) => (
                <div key={i}>
                  <p className="font-medium">{f.question}</p>
                  <p className="text-muted-foreground">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return <pre className="text-xs">{JSON.stringify(body, null, 2)}</pre>;
}

export function AssetCard({
  asset,
  onChange,
}: {
  asset: any;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const detail = asset.antiSlopDetail;

  async function review(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await onChange();
    setBusy(false);
  }

  async function regenerate() {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}/regenerate`, { method: "POST" });
    await onChange();
    setBusy(false);
  }

  const slopVariant =
    asset.antiSlopScore == null
      ? "secondary"
      : asset.antiSlopScore >= 70
        ? "success"
        : "warning";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {CHANNEL_LABEL[asset.channel] ?? asset.channel}
          {asset.antiSlopScore != null && (
            <Badge variant={slopVariant}>
              anti-slop {asset.antiSlopScore}/100
            </Badge>
          )}
          <Badge variant={REVIEW_VARIANT[asset.reviewStatus] ?? "outline"}>
            {asset.reviewStatus}
          </Badge>
          {asset.regenCount > 0 && (
            <Badge variant="outline">regenerated</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Body channel={asset.channel} body={asset.body} />

        {detail && (
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="font-medium">
              Anti-slop review
              {detail.couldGptWriteThis
                ? " — ⚠ a generic model could write this"
                : " — ✓ requires proprietary context"}
            </p>
            {detail.checks?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {detail.checks.map((c: any, i: number) => (
                  <li key={i}>
                    {c.passed ? "✓" : "✗"} {c.name}: {c.note}
                  </li>
                ))}
              </ul>
            )}
            {!detail.passes && detail.regenerateGuidance && (
              <p className="mt-1 text-muted-foreground">
                Guidance: {detail.regenerateGuidance}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => review("APPROVE")}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={regenerate}
          >
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => review("REJECT")}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
