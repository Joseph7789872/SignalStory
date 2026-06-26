"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeKind =
  | "COMPANY_DOC"
  | "CHANGELOG"
  | "CASE_STUDY"
  | "FOUNDER_POST"
  | "CALL_TRANSCRIPT"
  | "CUSTOMER_QUOTE"
  | "OTHER";

type Doc = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  sourceUrl: string | null;
  createdAt: string;
  chunks: number;
};

const KIND_LABELS: Record<KnowledgeKind, string> = {
  CASE_STUDY: "Case study",
  CHANGELOG: "Changelog",
  FOUNDER_POST: "Founder post",
  CALL_TRANSCRIPT: "Call transcript",
  CUSTOMER_QUOTE: "Customer quote",
  COMPANY_DOC: "Company doc",
  OTHER: "Other",
};

const KINDS = Object.keys(KIND_LABELS) as KnowledgeKind[];

export function KnowledgeManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [role, setRole] = useState("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add form state
  const [kind, setKind] = useState<KnowledgeKind>("CASE_STUDY");
  const [title, setTitle] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setDocs(data.docs);
      setRole(data.role);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === "OWNER";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    const body: Record<string, unknown> = { kind, title };
    if (inputMode === "text") {
      body.text = text;
    } else {
      body.sourceUrl = sourceUrl;
    }

    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add document");
    } else {
      const data = await res.json();
      setTitle("");
      setText("");
      setSourceUrl("");
      setSuccessMsg(`Added ${data.chunks} chunk${data.chunks === 1 ? "" : "s"}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await load();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this document and all its indexed chunks?")) return;
    setBusy(true);
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="kind">Kind</Label>
                  <select
                    id="kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as KnowledgeKind)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Acme Corp case study Q1 2024"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Label>Content</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setInputMode("text")}
                      className={
                        inputMode === "text"
                          ? "font-medium text-foreground underline underline-offset-2"
                          : "text-muted-foreground"
                      }
                    >
                      Paste text
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      onClick={() => setInputMode("url")}
                      className={
                        inputMode === "url"
                          ? "font-medium text-foreground underline underline-offset-2"
                          : "text-muted-foreground"
                      }
                    >
                      Fetch from URL
                    </button>
                  </div>
                </div>

                {inputMode === "text" ? (
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the full text of your document here (≥20 characters)…"
                    className="min-h-[120px]"
                    required
                  />
                ) : (
                  <Input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://yoursite.com/blog/case-study"
                    required
                  />
                )}
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? "Indexing…" : "Add document"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {successMsg && (
                <p className="text-sm text-emerald-600">{successMsg}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Only owners can add or remove knowledge documents.
        </p>
      )}

      <div className="space-y-3">
        {docs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No knowledge yet. Add a case study, changelog, or founder post to
            ground your content in real proof.
          </p>
        )}
        {docs.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="space-y-2 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{doc.title}</span>
                <Badge variant="outline">{KIND_LABELS[doc.kind]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {doc.chunks} chunk{doc.chunks === 1 ? "" : "s"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
              {doc.sourceUrl && (
                <p className="text-xs text-muted-foreground">
                  Source:{" "}
                  <a
                    href={doc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {doc.sourceUrl}
                  </a>
                </p>
              )}
              {isOwner && (
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(doc.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
