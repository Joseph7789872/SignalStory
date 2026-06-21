"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const toText = (a?: string[]) => (a ?? []).join("\n");

const pairs = (s: string) =>
  lines(s).map((l) => {
    const idx = l.indexOf(":");
    return idx === -1
      ? { name: l, value: "" }
      : { name: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
  });
const pairsText = (a: { name: string; value: string }[]) =>
  a.map((p) => `${p.name}: ${p.value}`).join("\n");

export function ContextForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completeness, setCompleteness] = useState(0);

  // flat form state
  const [f, setF] = useState({
    description: "",
    category: "",
    icp: "",
    founderName: "",
    beliefs: "",
    frameworks: "",
    lessons: "",
    writingSample: "",
    tone: "",
    sentenceStyle: "",
    opinionatedness: "",
    technicalDepth: "",
    bannedPhrases: "",
    prefer: "",
    avoid: "",
    pillars: "",
    audiences: "",
    goals: "",
    topicsToAvoid: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/context", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const fr = (d.founder?.frameworks ?? []) as {
          name: string;
          summary: string;
        }[];
        const pl = (d.editorial?.pillars ?? []) as {
          name: string;
          description: string;
        }[];
        const au = (d.editorial?.audiences ?? []) as {
          name: string;
          description: string;
        }[];
        const sample = (d.founder?.writingSamples ?? [])[0]?.text ?? "";
        setF({
          description: d.profile?.description ?? "",
          category: d.profile?.category ?? "",
          icp: d.profile?.icp ?? "",
          founderName: d.founder?.name ?? "",
          beliefs: toText(d.founder?.beliefs),
          frameworks: fr.map((x) => `${x.name}: ${x.summary}`).join("\n"),
          lessons: toText(d.founder?.lessons),
          writingSample: sample,
          tone: d.brandVoice?.tone ?? "",
          sentenceStyle: d.brandVoice?.sentenceStyle ?? "",
          opinionatedness: d.brandVoice?.opinionatedness ?? "",
          technicalDepth: d.brandVoice?.technicalDepth ?? "",
          bannedPhrases: toText(d.brandVoice?.bannedPhrases),
          prefer: toText(d.brandVoice?.vocabulary?.prefer),
          avoid: toText(d.brandVoice?.vocabulary?.avoid),
          pillars: pl.map((x) => `${x.name}: ${x.description}`).join("\n"),
          audiences: au.map((x) => `${x.name}: ${x.description}`).join("\n"),
          goals: toText(d.editorial?.goals),
          topicsToAvoid: toText(d.editorial?.topicsToAvoid),
        });
        setCompleteness(d.completeness ?? 0);
      }
      setLoaded(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      profile: {
        description: f.description,
        category: f.category,
        icp: f.icp,
      },
      founder: {
        name: f.founderName,
        beliefs: lines(f.beliefs),
        frameworks: pairs(f.frameworks).map((p) => ({
          name: p.name,
          summary: p.value,
        })),
        lessons: lines(f.lessons),
        writingSamples: f.writingSample.trim()
          ? [{ label: "Founder writing sample", text: f.writingSample.trim() }]
          : [],
      },
      brandVoice: {
        tone: f.tone,
        sentenceStyle: f.sentenceStyle,
        opinionatedness: f.opinionatedness,
        technicalDepth: f.technicalDepth,
        bannedPhrases: lines(f.bannedPhrases),
        vocabulary: { prefer: lines(f.prefer), avoid: lines(f.avoid) },
      },
      editorial: {
        pillars: pairs(f.pillars).map((p) => ({
          name: p.name,
          description: p.value,
        })),
        audiences: pairs(f.audiences).map((p) => ({
          name: p.name,
          description: p.value,
        })),
        goals: lines(f.goals),
        topicsToAvoid: lines(f.topicsToAvoid),
      },
    };
    const res = await fetch("/api/context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const d = await res.json();
      setCompleteness(d.completeness ?? completeness);
      if (redirectTo) router.push(redirectTo);
    }
    setSaving(false);
  }

  if (!loaded) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company</CardTitle>
          <CardDescription>What you do and who you serve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="What the company does">
            <Textarea value={f.description} onChange={set("description")} rows={2} />
          </Field>
          <Field label="Category">
            <Input value={f.category} onChange={set("category")} />
          </Field>
          <Field label="Ideal customer (ICP)">
            <Input value={f.icp} onChange={set("icp")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Founder brain</CardTitle>
          <CardDescription>
            How the founder thinks. This is what stops the output sounding
            generic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Founder name">
            <Input value={f.founderName} onChange={set("founderName")} />
          </Field>
          <Field label="Beliefs (one per line)">
            <Textarea value={f.beliefs} onChange={set("beliefs")} rows={4} />
          </Field>
          <Field label="Frameworks (name: summary, one per line)">
            <Textarea value={f.frameworks} onChange={set("frameworks")} rows={3} />
          </Field>
          <Field label="Lessons learned (one per line)">
            <Textarea value={f.lessons} onChange={set("lessons")} rows={3} />
          </Field>
          <Field label="A writing sample in the founder's voice">
            <Textarea
              value={f.writingSample}
              onChange={set("writingSample")}
              rows={4}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Tone">
            <Input value={f.tone} onChange={set("tone")} />
          </Field>
          <Field label="Sentence style">
            <Input value={f.sentenceStyle} onChange={set("sentenceStyle")} />
          </Field>
          <Field label="Banned phrases (one per line)">
            <Textarea
              value={f.bannedPhrases}
              onChange={set("bannedPhrases")}
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editorial strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Content pillars (name: description, one per line)">
            <Textarea value={f.pillars} onChange={set("pillars")} rows={3} />
          </Field>
          <Field label="Audiences (name: description, one per line)">
            <Textarea value={f.audiences} onChange={set("audiences")} rows={2} />
          </Field>
          <Field label="Goals (one per line)">
            <Textarea value={f.goals} onChange={set("goals")} rows={2} />
          </Field>
          <Field label="Topics to avoid (one per line)">
            <Textarea
              value={f.topicsToAvoid}
              onChange={set("topicsToAvoid")}
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : redirectTo ? "Save & continue" : "Save context"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Context {completeness}% complete
        </span>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
