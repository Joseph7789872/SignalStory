"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Version = {
  id: string;
  version: string;
  isActive: boolean;
  instruction: string;
  createdAt: string;
};
type AgentBlock = {
  agent: string;
  label: string;
  defaultVersion: string;
  defaultInstruction: string;
  activeVersion: string;
  usingDefault: boolean;
  versions: Version[];
};
type Performance = Record<
  string,
  { runs: number; feedback: Record<string, number> }
>;

function PerfLine({ perf }: { perf?: { runs: number; feedback: Record<string, number> } }) {
  if (!perf) return <span className="text-muted-foreground">no runs yet</span>;
  const fb = perf.feedback;
  const parts = Object.entries(fb).map(([k, v]) => `${k.toLowerCase()} ${v}`);
  return (
    <span className="text-muted-foreground">
      {perf.runs} run{perf.runs === 1 ? "" : "s"}
      {parts.length ? ` · ${parts.join(", ")}` : ""}
    </span>
  );
}

function AgentCard({
  block,
  performance,
  onChange,
}: {
  block: AgentBlock;
  performance: Performance;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [instruction, setInstruction] = useState(block.defaultInstruction);
  const [busy, setBusy] = useState(false);

  async function activate(v: string) {
    setBusy(true);
    await fetch("/api/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: block.agent, version: v }),
    });
    await onChange();
    setBusy(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!version.trim() || instruction.trim().length < 10) return;
    setBusy(true);
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: block.agent,
        version: version.trim(),
        instruction,
        activate: true,
      }),
    });
    setVersion("");
    setOpen(false);
    await onChange();
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {block.label}
          <Badge variant="outline">active: {block.activeVersion}</Badge>
          {block.usingDefault && <Badge variant="secondary">in-code default</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {block.versions.length === 0 && (
          <p className="text-muted-foreground">
            No stored versions — using the in-code default ({block.defaultVersion}).
            Run <code>npx tsx scripts/seed-prompts.ts</code> to import it, or create
            a new version below.
          </p>
        )}
        {block.versions.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-3 rounded border p-2"
          >
            <div>
              <span className="font-medium">{v.version}</span>{" "}
              {v.isActive && <Badge variant="success">active</Badge>}
              <div className="text-xs">
                <PerfLine perf={performance[v.version]} />
              </div>
            </div>
            {!v.isActive && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => activate(v.version)}
              >
                Activate
              </Button>
            )}
          </div>
        ))}

        {open ? (
          <form onSubmit={create} className="space-y-2 rounded border p-3">
            <div className="space-y-1">
              <Label className="text-xs">New version id</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder={`${block.agent}.v2`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instruction</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create & activate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setInstruction(block.defaultInstruction);
              setOpen(true);
            }}
          >
            New version
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PromptManager() {
  const [agents, setAgents] = useState<AgentBlock[]>([]);
  const [performance, setPerformance] = useState<Performance>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/prompts", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents);
      setPerformance(data.performance);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {agents.map((block) => (
        <AgentCard
          key={block.agent}
          block={block}
          performance={performance}
          onChange={load}
        />
      ))}
    </div>
  );
}
