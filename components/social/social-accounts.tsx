"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Account = {
  id: string;
  provider: string;
  status: string;
  displayName: string;
  expiresAt: string | null;
};

export function SocialAccounts() {
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/social", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setAccounts(d.accounts ?? []);
      setConfigured(Boolean(d.linkedinConfigured));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const linkedin = accounts.find((a) => a.provider === "LINKEDIN");
  const flag = params.get("linkedin"); // connected | error

  async function disconnect() {
    setBusy(true);
    await fetch("/api/social?provider=LINKEDIN", { method: "DELETE" });
    await load();
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publish to LinkedIn</CardTitle>
        <CardDescription>
          Connect LinkedIn to auto-publish scheduled founder posts at their
          scheduled time — no manual copy-paste.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {flag === "connected" && (
          <p className="text-success">LinkedIn connected.</p>
        )}
        {flag === "error" && (
          <p className="text-destructive">
            Couldn’t connect LinkedIn ({params.get("msg") ?? "error"}).
          </p>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !configured ? (
          <p className="text-muted-foreground">
            LinkedIn publishing isn’t configured on this deployment.
          </p>
        ) : linkedin && linkedin.status !== "REVOKED" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={linkedin.status === "ACTIVE" ? "success" : "warning"}>
              {linkedin.status}
            </Badge>
            <span className="font-medium">{linkedin.displayName || "LinkedIn account"}</span>
            {linkedin.status === "EXPIRED" && (
              <a href="/api/oauth/linkedin/start" className="underline">
                Reconnect
              </a>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <a href="/api/oauth/linkedin/start">Connect LinkedIn</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
