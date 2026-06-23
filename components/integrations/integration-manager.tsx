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
  config: { wonDealsOnly?: boolean; completedOnly?: boolean; events?: string[] };
  lastEventAt: string | null;
  webhookUrl: string | null;
};

const SECRET_HELP: Record<string, string> = {
  PIPEDRIVE: 'Enter "username:password" — the same HTTP Auth username + password you set on the Pipedrive webhook',
  ATTIO: "Attio → Workspace → Developers → your integration → Webhooks secret",
  LINEAR: "Linear → Settings → API → Webhooks → signing secret",
  GITHUB: "The secret you set when creating the GitHub webhook",
  WEBHOOK: "A long random string you choose — you'll paste it into Zapier/Make too",
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

// Update a connection's signing secret after the fact — needed for providers
// (Attio, Linear) that generate the secret only once the webhook is created.
function SecretUpdater({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (secret: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setOpen(true)}
      >
        Update signing secret
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 pt-1">
      <Input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="paste the secret the provider generated"
        className="h-8 text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || val.length < 8}
        onClick={() => {
          onSave(val);
          setVal("");
          setOpen(false);
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
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
  const [provider, setProvider] = useState("PIPEDRIVE");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [wonDealsOnly, setWonDealsOnly] = useState(true);
  const [completedOnly, setCompletedOnly] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProviders(data.providers);
      setConnections(data.connections);
      setRole(data.role);
      // Default the picker to the first available provider.
      setProvider((cur) =>
        data.providers.some((p: Provider) => p.provider === cur)
          ? cur
          : (data.providers[0]?.provider ?? cur),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === "OWNER";
  const isWebhook = provider === "WEBHOOK";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const config: Record<string, unknown> = {};
    if (provider === "PIPEDRIVE") config.wonDealsOnly = wonDealsOnly;
    if (provider === "LINEAR") config.completedOnly = completedOnly;
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

  async function updateSecret(id: string, newSecret: string) {
    if (newSecret.length < 8) return;
    setBusy(true);
    await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, secret: newSecret }),
    });
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
                    placeholder="e.g. Production CRM"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="secret">
                  {isWebhook ? "Shared secret (bearer token you choose)" : "Signing secret"}
                </Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={SECRET_HELP[provider] ?? "Provider signing secret"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {SECRET_HELP[provider] ?? ""}
                </p>
              </div>

              {provider === "PIPEDRIVE" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={wonDealsOnly}
                    onChange={(e) => setWonDealsOnly(e.target.checked)}
                  />
                  Only ingest deals that are marked <strong>won</strong>
                </label>
              )}
              {provider === "LINEAR" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={completedOnly}
                    onChange={(e) => setCompletedOnly(e.target.checked)}
                  />
                  Only ingest issues/projects that <strong>completed</strong>
                </label>
              )}

              {isWebhook && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Connect anything via Zapier or Make
                  </p>
                  <p className="mt-1">
                    After connecting, point a Zap/Make scenario (HubSpot, Salesforce,
                    Gong, Slack, …) at the webhook URL below. Set request header{" "}
                    <code className="rounded bg-background px-1">
                      Authorization: Bearer &lt;your secret&gt;
                    </code>{" "}
                    and POST a JSON body mapped to:
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded bg-background p-2">
{`{ "title": "...", "description": "...",
  "evidence": "...", "links": ["..."],
  "externalId": "<stable id for dedup>" }`}
                  </pre>
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
                {c.config?.wonDealsOnly && (
                  <Badge variant="outline">won deals only</Badge>
                )}
                {c.config?.completedOnly && (
                  <Badge variant="outline">completed only</Badge>
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
                    {c.provider === "WEBHOOK"
                      ? "POST events here (with your bearer secret header):"
                      : `Paste this webhook URL into ${c.provider}:`}
                  </p>
                  <CopyField value={c.webhookUrl} />
                </div>
              )}
              {isOwner && (
                <SecretUpdater busy={busy} onSave={(s) => updateSecret(c.id, s)} />
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
