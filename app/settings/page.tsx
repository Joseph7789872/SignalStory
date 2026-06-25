"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Billing = {
  billingConfigured: boolean;
  role: "OWNER" | "MEMBER";
  orgName: string;
  email: string;
  plan: "FREE" | "STARTER" | "PRO";
  planLabel: string;
  signalsUsed: number;
  signalQuota: number;
  spendUsd: number;
  hardSpendCapUsd: number;
  periodEnd: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function billingAction(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      if (json.url) window.location.href = json.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  }

  async function exportData() {
    window.location.href = "/api/account";
  }

  async function deleteOrg() {
    if (
      !window.confirm(
        "Permanently delete this organization and ALL its data? This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Delete failed");
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-destructive">Couldn’t load settings.</p>;

  const isOwner = data.role === "OWNER";
  const pct =
    data.signalQuota > 0
      ? Math.min(100, Math.round((data.signalsUsed / data.signalQuota) * 100))
      : 0;
  const overQuota = data.signalsUsed >= data.signalQuota;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="billing">
        <TabsList>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {data.planLabel} plan
              </CardTitle>
              <CardDescription>
                Usage resets each billing period
                {data.periodEnd
                  ? ` (renews ${new Date(data.periodEnd).toLocaleDateString()})`
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signals this period</span>
                  <span className="font-medium">
                    {data.signalsUsed} / {data.signalQuota}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${overQuota ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {overQuota && (
                  <p className="text-destructive">
                    You’ve reached your monthly signal limit. Upgrade to keep
                    publishing.
                  </p>
                )}
              </div>
              <p className="text-muted-foreground">
                Spend this period: ${data.spendUsd.toFixed(2)} / $
                {data.hardSpendCapUsd.toFixed(2)} cap
              </p>

              {!data.billingConfigured ? (
                <p className="text-muted-foreground">
                  Billing isn’t configured on this deployment.
                </p>
              ) : !isOwner ? (
                <p className="text-muted-foreground">
                  Only an owner can change the plan.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.plan !== "STARTER" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => billingAction({ action: "checkout", plan: "STARTER" })}
                    >
                      Get Starter
                    </Button>
                  )}
                  {data.plan !== "PRO" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => billingAction({ action: "checkout", plan: "PRO" })}
                    >
                      Get Pro
                    </Button>
                  )}
                  {data.plan !== "FREE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => billingAction({ action: "portal" })}
                    >
                      Manage billing
                    </Button>
                  )}
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Organization:</span>{" "}
                {data.orgName}
              </p>
              <p>
                <span className="text-muted-foreground">Signed in as:</span>{" "}
                {data.email} ({data.role.toLowerCase()})
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger zone */}
        <TabsContent value="danger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export your data</CardTitle>
              <CardDescription>
                Download everything in your organization as JSON.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={exportData}>
                Export data
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                Delete organization
              </CardTitle>
              <CardDescription>
                Permanently deletes this workspace and all its signals, content,
                context, and knowledge. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isOwner ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={deleteOrg}
                >
                  Delete organization
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only an owner can delete the organization.
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
