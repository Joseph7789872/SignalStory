"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Provider = { slug: string; provider: string; label: string };
type Connection = {
  id: string;
  provider: string;
  label: string;
  status: string;
  config: { minAmountUsd?: number; events?: string[] };
  lastEventAt: string | null;
  webhookUrl: string | null;
};

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
        {value}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}

export function IntegrationManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [role, setRole] = useState("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [provider, setProvider] = useState("STRIPE");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [minAmount, setMinAmount] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProviders(data.providers);
      setConnections(data.connections);
      setRole(data.role);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === "OWNER";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const config: Record<string, unknown> = {};
    if (provider === "STRIPE" && minAmount) config.minAmountUsd = Number(minAmount);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, label, secret, config }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Failed to connect");
    } else {
      setSecret("");
      setLabel("");
      setMinAmount("");
      await load();
    }
    setBusy(false);
  }

  async function toggle(id: string, status: string) {
    setBusy(true);
    await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: status === "ACTIVE" ? "PAUSED" : "ACTIVE" }),
    });
    await load();
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Disconnect this integration?")) return;
    setBusy(true);
    await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect a source</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="provider">Provider</Label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {providers.map((p) => (
                      <option key={p.provider} value={p.provider}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="label">Label (optional)</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Production Stripe"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="secret">Signing secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={
                    provider === "STRIPE"
                      ? "whsec_… (Stripe webhook signing secret)"
                      : "GitHub webhook secret"
                  }
                  required
                />
              </div>
              {provider === "STRIPE" && (
                <div className="space-y-1">
                  <Label htmlFor="min">Min amount (USD, optional)</Label>
                  <Input
                    id="min"
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="e.g. 100 — ignore charges below this"
                  />
                </div>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Connecting…" : "Connect"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {connections.length === 0 && (
          <p className="text-sm text-muted-foreground">No integrations yet.</p>
        )}
        {connections.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-2 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.label || c.provider}</span>
                <Badge variant="outline">{c.provider}</Badge>
                <Badge variant={c.status === "ACTIVE" ? "success" : "secondary"}>
                  {c.status}
                </Badge>
                {c.config?.minAmountUsd != null && (
                  <Badge variant="outline">min ${c.config.minAmountUsd}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {c.lastEventAt
                    ? `last event ${new Date(c.lastEventAt).toLocaleString()}`
                    : "no events yet"}
                </span>
              </div>
              {c.webhookUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Paste this webhook URL into {c.provider}:
                  </p>
                  <CopyField value={c.webhookUrl} />
                </div>
              )}
              {isOwner && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => toggle(c.id, c.status)}
                  >
                    {c.status === "ACTIVE" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(c.id)}
                  >
                    Disconnect
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
