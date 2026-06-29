"use client";

import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

type Log = {
  id: string;
  action: string;
  actorEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (action: string) => {
    const res = await fetch(`/api/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`, {
      cache: "no-store",
    });
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) setLogs((await res.json()).logs);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(filter), 250);
    return () => clearTimeout(t);
  }, [filter, load]);

  if (forbidden) return <p className="text-muted-foreground">Only an owner can view the audit log.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="A record of meaningful actions in your workspace."
      />

      <Input
        placeholder="Filter by action (e.g. signal, asset, linkedin)…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {!logs ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">No matching activity.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0 text-sm">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {l.action}
                </Badge>
                {l.resourceType && (
                  <span className="text-muted-foreground">
                    {l.resourceType}
                    {l.resourceId ? ` · ${l.resourceId.slice(0, 8)}` : ""}
                  </span>
                )}
                <span className="flex-1 text-muted-foreground">{l.actorEmail ?? "system"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
