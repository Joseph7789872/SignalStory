"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const linesToArray = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const arrayToLines = (a?: unknown) =>
  Array.isArray(a) ? (a as string[]).join("\n") : "";

type FaqItem = { question: string; answer: string };

/**
 * Channel-specific inline editor. Edits a local draft of the asset body and,
 * on save, hands the edited body back to the parent, which persists it via
 * POST /api/assets/[id]/review with { decision: "EDIT", editedBody }.
 */
export function AssetEditor({
  channel,
  body,
  busy,
  onSave,
  onCancel,
}: {
  channel: string;
  body: any;
  busy: boolean;
  onSave: (editedBody: unknown) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<any>(() =>
    typeof structuredClone === "function"
      ? structuredClone(body ?? {})
      : JSON.parse(JSON.stringify(body ?? {})),
  );
  const set = (k: string, v: unknown) => setD((p: any) => ({ ...p, [k]: v }));

  function field(label: string, node: React.ReactNode) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        {node}
      </div>
    );
  }

  let fields: React.ReactNode = null;

  if (channel === "LINKEDIN_FOUNDER") {
    fields = (
      <>
        {field(
          "Hook",
          <Input value={d.hook ?? ""} onChange={(e) => set("hook", e.target.value)} />,
        )}
        {field(
          "Body",
          <Textarea
            rows={8}
            value={d.body ?? ""}
            onChange={(e) => set("body", e.target.value)}
          />,
        )}
        {field(
          "Takeaway",
          <Input
            value={d.takeaway ?? ""}
            onChange={(e) => set("takeaway", e.target.value)}
          />,
        )}
        {field(
          "Hashtags (one per line)",
          <Textarea
            rows={3}
            value={arrayToLines(d.hashtags)}
            onChange={(e) => set("hashtags", linesToArray(e.target.value))}
          />,
        )}
      </>
    );
  } else if (channel === "X_THREAD") {
    fields = field(
      "Tweets (one per line)",
      <Textarea
        rows={10}
        value={arrayToLines(d.tweets)}
        onChange={(e) => set("tweets", linesToArray(e.target.value))}
      />,
    );
  } else if (channel === "BLOG_POST") {
    const faq: FaqItem[] = Array.isArray(d.faq) ? d.faq : [];
    const setFaq = (next: FaqItem[]) => set("faq", next);
    fields = (
      <>
        {field(
          "SEO title (≤60)",
          <Input
            value={d.seoTitle ?? ""}
            onChange={(e) => set("seoTitle", e.target.value)}
          />,
        )}
        {field(
          "Meta description (≤155)",
          <Textarea
            rows={2}
            value={d.metaDescription ?? ""}
            onChange={(e) => set("metaDescription", e.target.value)}
          />,
        )}
        {field(
          "Slug",
          <Input value={d.slug ?? ""} onChange={(e) => set("slug", e.target.value)} />,
        )}
        {field(
          "Primary keyword",
          <Input
            value={d.primaryKeyword ?? ""}
            onChange={(e) => set("primaryKeyword", e.target.value)}
          />,
        )}
        {field(
          "Secondary keywords (one per line)",
          <Textarea
            rows={3}
            value={arrayToLines(d.secondaryKeywords)}
            onChange={(e) =>
              set("secondaryKeywords", linesToArray(e.target.value))
            }
          />,
        )}
        {field(
          "H1",
          <Input value={d.h1 ?? ""} onChange={(e) => set("h1", e.target.value)} />,
        )}
        {field(
          "TL;DR",
          <Textarea
            rows={3}
            value={d.tldr ?? ""}
            onChange={(e) => set("tldr", e.target.value)}
          />,
        )}
        {field(
          "Body (Markdown)",
          <Textarea
            rows={16}
            className="font-mono text-xs"
            value={d.bodyMarkdown ?? ""}
            onChange={(e) => set("bodyMarkdown", e.target.value)}
          />,
        )}
        {field(
          "Key takeaways (one per line)",
          <Textarea
            rows={4}
            value={arrayToLines(d.keyTakeaways)}
            onChange={(e) => set("keyTakeaways", linesToArray(e.target.value))}
          />,
        )}
        <div className="space-y-2">
          <Label className="text-xs">FAQ</Label>
          {faq.map((item, i) => (
            <div key={i} className="space-y-1 rounded border p-2">
              <Input
                placeholder="Question"
                value={item.question}
                onChange={(e) => {
                  const next = [...faq];
                  next[i] = { ...next[i], question: e.target.value };
                  setFaq(next);
                }}
              />
              <Textarea
                rows={2}
                placeholder="Answer"
                value={item.answer}
                onChange={(e) => {
                  const next = [...faq];
                  next[i] = { ...next[i], answer: e.target.value };
                  setFaq(next);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFaq(faq.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFaq([...faq, { question: "", answer: "" }])}
          >
            Add FAQ item
          </Button>
        </div>
      </>
    );
  } else {
    fields = field(
      "Body (JSON)",
      <Textarea
        rows={12}
        className="font-mono text-xs"
        value={JSON.stringify(d, null, 2)}
        onChange={(e) => {
          try {
            setD(JSON.parse(e.target.value));
          } catch {
            /* ignore until valid */
          }
        }}
      />,
    );
  }

  return (
    <div className="space-y-3">
      {fields}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onSave(d)}>
          {busy ? "Saving…" : "Save edits"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
