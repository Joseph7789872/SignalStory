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
import { AssetEditor } from "@/components/signal/asset-editor";
import { buildBlogJsonLd } from "@/lib/seo/jsonld";

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

        <JsonLdBlock body={body} />
      </div>
    );
  }
  return <pre className="text-xs">{JSON.stringify(body, null, 2)}</pre>;
}

/** Collapsible schema.org JSON-LD (Article + FAQPage) with a copy button. */
function JsonLdBlock({ body }: { body: any }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(buildBlogJsonLd(body), null, 2);
  return (
    <details className="rounded-md border bg-muted/40 p-3 text-xs">
      <summary className="cursor-pointer font-medium">
        JSON-LD structured data (Article + FAQPage)
      </summary>
      <div className="mt-2 space-y-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(
              `<script type="application/ld+json">\n${json}\n</script>`,
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy JSON-LD"}
        </Button>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
          {json}
        </pre>
      </div>
    </details>
  );
}

export function AssetCard({
  asset,
  onChange,
}: {
  asset: any;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  // Once any action is taken, collapse the action row into a single
  // "Change decision" toggle. Seed from the asset so a reload of an
  // already-decided (or regenerated) asset stays collapsed.
  const [decided, setDecided] = useState(
    ["APPROVED", "EDITED", "REJECTED"].includes(asset.reviewStatus) ||
      asset.regenCount > 0,
  );
  const detail = asset.antiSlopDetail;
  // The human-edited body wins over the generated one, everywhere.
  const current = asset.editedBody ?? asset.body;

  async function review(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await onChange();
    setBusy(false);
    setDecided(true);
  }

  async function saveEdit(editedBody: unknown) {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "EDIT", editedBody }),
    });
    await onChange();
    setBusy(false);
    setEditing(false);
    setDecided(true);
  }

  async function regenerate() {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}/regenerate`, { method: "POST" });
    await onChange();
    setBusy(false);
    setDecided(true);
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
          {asset.editedBody && <Badge variant="outline">edited</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <AssetEditor
            channel={asset.channel}
            body={current}
            busy={busy}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <Body channel={asset.channel} body={current} />

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
          {decided ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDecided(false)}
            >
              Change decision
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => review("APPROVE")}
              >
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
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
