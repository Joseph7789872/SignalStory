"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const linesToArray = (s: string) =>
  s.split("\n").map((l) => l.trim()).filter(Boolean);

// "Name: Description" per line → { name, description }[]
const pairsToArray = (s: string) =>
  linesToArray(s)
    .map((line) => {
      const i = line.indexOf(":");
      if (i === -1) return { name: line, description: "" };
      return { name: line.slice(0, i).trim(), description: line.slice(i + 1).trim() };
    })
    .filter((p) => p.name);

const STEPS = ["Company", "Founder", "Brand voice", "Editorial", "Knowledge"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completeness, setCompleteness] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Company
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [icp, setIcp] = useState("");
  // Step 2 — Founder
  const [founderName, setFounderName] = useState("");
  const [beliefs, setBeliefs] = useState("");
  const [writingSample, setWritingSample] = useState("");
  // Step 3 — Brand voice
  const [tone, setTone] = useState("");
  const [sentenceStyle, setSentenceStyle] = useState("");
  const [bannedPhrases, setBannedPhrases] = useState("");
  // Step 4 — Editorial
  const [pillars, setPillars] = useState("");
  const [audiences, setAudiences] = useState("");
  const [goals, setGoals] = useState("");
  // Step 5 — Knowledge
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");

  // Prefill from existing context (so an interrupted setup resumes).
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/context", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setCompleteness(d.completeness ?? 0);
      setDescription(d.profile?.description ?? "");
      setCategory(d.profile?.category ?? "");
      setIcp(d.profile?.icp ?? "");
      setFounderName(d.founder?.name ?? "");
      setBeliefs((d.founder?.beliefs ?? []).join("\n"));
      setWritingSample(d.founder?.writingSamples?.[0]?.text ?? "");
      setTone(d.brandVoice?.tone ?? "");
      setSentenceStyle(d.brandVoice?.sentenceStyle ?? "");
      setBannedPhrases((d.brandVoice?.bannedPhrases ?? []).join("\n"));
      setPillars(
        (d.editorial?.pillars ?? [])
          .map((p: { name: string; description: string }) => `${p.name}: ${p.description}`)
          .join("\n"),
      );
      setAudiences(
        (d.editorial?.audiences ?? [])
          .map((a: { name: string; description: string }) => `${a.name}: ${a.description}`)
          .join("\n"),
      );
      setGoals((d.editorial?.goals ?? []).join("\n"));
    })();
  }, []);

  function sliceForStep(i: number): Record<string, unknown> | null {
    if (i === 0) return { profile: { description, category, icp } };
    if (i === 1)
      return {
        founder: {
          name: founderName,
          beliefs: linesToArray(beliefs),
          writingSamples: writingSample.trim()
            ? [{ label: "Founder writing sample", text: writingSample }]
            : [],
        },
      };
    if (i === 2)
      return {
        brandVoice: { tone, sentenceStyle, bannedPhrases: linesToArray(bannedPhrases) },
      };
    if (i === 3)
      return {
        editorial: {
          pillars: pairsToArray(pillars),
          audiences: pairsToArray(audiences),
          goals: linesToArray(goals),
        },
      };
    return null; // step 4 = knowledge (handled separately)
  }

  async function saveCurrent(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      if (step <= 3) {
        const res = await fetch("/api/context", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sliceForStep(step)),
        });
        if (!res.ok) throw new Error("Couldn't save");
        setCompleteness((await res.json()).completeness ?? completeness);
      } else if (docText.trim().length >= 20 && docTitle.trim()) {
        // Step 5 — optional first knowledge doc (owner-gated route).
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "COMPANY_DOC", title: docTitle, text: docText }),
        });
        if (!res.ok && res.status !== 403) throw new Error("Couldn't save the document");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!(await saveCurrent())) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else await finish();
  }

  async function finish() {
    setBusy(true);
    await fetch("/api/onboarding", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
  }

  async function skip() {
    setBusy(true);
    await fetch("/api/onboarding", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </span>
          <span>Context {completeness}% complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
        </div>
      </div>

      {step === 0 && (
        <Section title="What does your company do?" hint="Plain language. This anchors every story.">
          <Field label="Description" example="We help B2B SaaS teams turn product usage signals into customer-facing content automatically." value={description} onChange={setDescription} onExample={setDescription} textarea />
          <Field label="Category" example="AI content / developer tools" value={category} onChange={setCategory} onExample={setCategory} />
          <Field label="Ideal customer" example="Seed–Series B B2B SaaS founders and heads of marketing" value={icp} onChange={setIcp} onExample={setIcp} textarea />
        </Section>
      )}

      {step === 1 && (
        <Section title="Who's the founder voice?" hint="Beliefs + a writing sample are the biggest quality lever.">
          <Field label="Founder name" value={founderName} onChange={setFounderName} />
          <Field label="Core beliefs (one per line)" example={"Distribution beats product in early stage.\nMost AI content fails because it starts with writing.\nShow the work; don't just claim the result."} value={beliefs} onChange={setBeliefs} onExample={setBeliefs} textarea rows={5} />
          <Field label="A writing sample (paste a post you're proud of)" example="Last week a customer told us our onboarding felt like cheating. Here's the uncomfortable truth behind why most onboarding doesn't…" value={writingSample} onChange={setWritingSample} onExample={setWritingSample} textarea rows={6} />
        </Section>
      )}

      {step === 2 && (
        <Section title="How should it sound?" hint="Tone + banned phrases keep it from sounding like a model.">
          <Field label="Tone" example="Direct, opinionated, a little contrarian. No hype." value={tone} onChange={setTone} onExample={setTone} textarea />
          <Field label="Sentence style" example="Short. Concrete. Specifics over adjectives." value={sentenceStyle} onChange={setSentenceStyle} onExample={setSentenceStyle} textarea />
          <Field label="Banned phrases (one per line)" example={"unlock\nleverage\ngame-changer\nin today's fast-paced world\nrevolutionize"} value={bannedPhrases} onChange={setBannedPhrases} onExample={setBannedPhrases} textarea rows={4} />
        </Section>
      )}

      {step === 3 && (
        <Section title="Editorial strategy" hint="Format: Name: Description (one per line).">
          <Field label="Content pillars" example={"Build in public: lessons from shipping\nGo-to-market: distribution tactics that worked\nProduct philosophy: why we say no"} value={pillars} onChange={setPillars} onExample={setPillars} textarea rows={4} />
          <Field label="Audiences" example={"Founders: early-stage B2B SaaS\nMarketers: solo content owners"} value={audiences} onChange={setAudiences} onExample={setAudiences} textarea rows={3} />
          <Field label="Goals (one per line)" example={"Build founder brand\nDrive inbound demo requests"} value={goals} onChange={setGoals} onExample={setGoals} textarea rows={3} />
        </Section>
      )}

      {step === 4 && (
        <Section title="Add your first knowledge doc (optional)" hint="A case study or changelog the pipeline can cite as proof. Owner-only; you can add more later under Knowledge.">
          <Field label="Title" value={docTitle} onChange={setDocTitle} />
          <Field label="Paste text" example="Case study: How Acme cut onboarding time 40%…" value={docText} onChange={setDocText} onExample={setDocText} textarea rows={6} />
        </Section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={skip}>
            Skip for now
          </Button>
        </div>
        <Button disabled={busy} onClick={next}>
          {step < STEPS.length - 1 ? "Save & continue" : "Finish"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  example,
  onExample,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  example?: string;
  onExample?: (v: string) => void;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {example && onExample && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => onExample(example)}
          >
            Use example
          </button>
        )}
      </div>
      {textarea ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example}
          rows={rows ?? 3}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={example} />
      )}
    </div>
  );
}
