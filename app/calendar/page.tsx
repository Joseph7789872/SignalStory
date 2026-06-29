"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Post = {
  id: string;
  assetId: string;
  signalId: string;
  channel: "LINKEDIN_FOUNDER" | "X_THREAD" | "BLOG_POST";
  scheduledFor: string;
  status: "SCHEDULED" | "POSTED" | "CANCELED";
  note: string | null;
  postedAt: string | null;
  autopublish: boolean;
  publishError: string | null;
  title: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN_FOUNDER: "LinkedIn",
  X_THREAD: "X thread",
  BLOG_POST: "Blog post",
};

const STATUS_VARIANT: Record<string, "secondary" | "success" | "outline"> = {
  SCHEDULED: "secondary",
  POSTED: "success",
  CANCELED: "outline",
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule", { cache: "no-store" });
    if (res.ok) setPosts((await res.json()).posts);
    else setPosts([]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, data: Record<string, unknown>) {
    setBusy(id);
    await fetch("/api/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    await load();
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  async function reschedule(id: string) {
    const next = window.prompt("New date/time (YYYY-MM-DDTHH:MM)");
    if (!next) return;
    const d = new Date(next);
    if (Number.isNaN(d.getTime())) return;
    await patch(id, { scheduledFor: d.toISOString() });
  }

  if (posts === null) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content calendar</h1>
        <p className="text-sm text-muted-foreground">
          Plan when to publish. Mark posts as posted once they’re live.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled yet. Open a ready signal and use “Schedule” on any
          asset.
        </p>
      ) : (
        Object.entries(
          posts.reduce<Record<string, Post[]>>((acc, p) => {
            (acc[dayKey(p.scheduledFor)] ??= []).push(p);
            return acc;
          }, {}),
        ).map(([day, dayPosts]) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
            {dayPosts.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-medium tabular-nums">
                    {new Date(p.scheduledFor).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge variant="outline">{CHANNEL_LABEL[p.channel]}</Badge>
                  {p.autopublish && <Badge variant="secondary">auto</Badge>}
                  <Link href={`/signals/${p.signalId}`} className="flex-1 hover:underline">
                    {p.title}
                  </Link>
                  {p.publishError && (
                    <span className="text-xs text-destructive" title={p.publishError}>
                      publish failed
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                    {p.status}
                  </Badge>
                  {p.status === "SCHEDULED" && (
                    <div className="flex gap-1">
                      <Button size="sm" disabled={busy === p.id} onClick={() => patch(p.id, { status: "POSTED" })}>
                        Mark posted
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => reschedule(p.id)}>
                        Reschedule
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => remove(p.id)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
