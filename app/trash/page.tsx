"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

type Item = { id: string; title: string; deletedAt: string; kind?: string };
type Trash = { signals: Item[]; docs: Item[] };

export default function TrashPage() {
  const [data, setData] = useState<Trash | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/trash", { cache: "no-store" });
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(method: "POST" | "DELETE", resourceType: "Signal" | "MemoryDoc", id: string) {
    if (method === "DELETE" && !window.confirm("Permanently delete? This cannot be undone.")) return;
    setBusy(id);
    await fetch("/api/trash", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceType, id }),
    });
    await load();
    setBusy(null);
  }

  if (forbidden) return <p className="text-muted-foreground">Only an owner can view the trash.</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;

  const Section = ({ title, items, type }: { title: string; items: Item[]; type: "Signal" | "MemoryDoc" }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">Nothing here.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
              <span className="flex-1">{it.title}</span>
              {it.kind && <Badge variant="outline">{it.kind}</Badge>}
              <span className="text-xs text-muted-foreground">
                {new Date(it.deletedAt).toLocaleDateString()}
              </span>
              <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => act("POST", type, it.id)}>
                Restore
              </Button>
              <Button size="sm" variant="destructive" disabled={busy === it.id} onClick={() => act("DELETE", type, it.id)}>
                Delete forever
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash"
        description="Deleted signals and knowledge docs. Restore them or delete permanently."
      />
      <Section title="Signals" items={data.signals} type="Signal" />
      <Section title="Knowledge docs" items={data.docs} type="MemoryDoc" />
    </div>
  );
}
