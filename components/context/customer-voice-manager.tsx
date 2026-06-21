"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Entry = {
  id: string;
  kind: string;
  text: string;
  source: string;
  createdAt: string;
};

const KINDS = [
  "discovery_call",
  "objection",
  "testimonial",
  "review",
  "churn",
  "support",
];

export function CustomerVoiceManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState(KINDS[0]);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/customer-voice", { cache: "no-store" });
    if (res.ok) setEntries((await res.json()).entries);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setBusy(true);
    await fetch("/api/customer-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, text, source }),
    });
    setText("");
    setSource("");
    await load();
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/customer-voice?id=${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="kind">Kind</Label>
                <select
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="source">Source (optional)</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Acme call, G2 review"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="text">Exact customer language</Label>
              <Textarea
                id="text"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="&ldquo;We didn&rsquo;t switch for the features — we switched because your audit logs passed our security review.&rdquo;"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Add entry"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No entries yet. Add real customer language above.
          </p>
        )}
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-start justify-between gap-4 py-3">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.kind}</Badge>
                  {e.source && (
                    <span className="text-xs text-muted-foreground">
                      {e.source}
                    </span>
                  )}
                </div>
                <p>{e.text}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => remove(e.id)}
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
