"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewSignalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [links, setLinks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setQuotaMsg(null);
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          evidence,
          links: links
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      // Hard quota block — prompt to upgrade instead of a generic error.
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        const u = data.usage;
        setQuotaMsg(
          u
            ? `You've used ${u.signalsUsed}/${u.signalQuota} signals this period.`
            : "You've reached your monthly limit.",
        );
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit");
      }
      const { id } = await res.json();
      router.push(`/signals/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to signals
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">New signal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what happened. Be concrete — real numbers, names, and
          specifics make the difference between a story and slop.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">What happened?</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Signed our first enterprise customer"
                required
                minLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Details</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was surprising? What did you learn? What was the context?"
                rows={5}
                required
                minLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence">Evidence / proof (optional)</Label>
              <Textarea
                id="evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Numbers, quotes, metrics, specifics."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="links">Links (one per line, optional)</Label>
              <Textarea
                id="links"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                rows={2}
              />
            </div>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {quotaMsg && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                {quotaMsg}{" "}
                <Link href="/settings" className="font-medium text-brand underline">
                  Upgrade your plan
                </Link>{" "}
                to keep publishing.
              </div>
            )}
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {submitting ? "Submitting…" : "Run pipeline"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
