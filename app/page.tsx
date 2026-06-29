import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gauge,
  Lightbulb,
  Plug,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PipelineStep = {
  icon: LucideIcon;
  title: string;
  desc: string;
  gate?: boolean;
};

const PIPELINE: PipelineStep[] = [
  {
    icon: Activity,
    title: "Signal",
    desc: "You submit a real company moment — a launch, a win, a lesson.",
  },
  {
    icon: Gauge,
    title: "Significance gate",
    desc: "It's scored. Not everything is worth publishing; weak signals stop here.",
    gate: true,
  },
  {
    icon: Lightbulb,
    title: "Story",
    desc: "We find the angle — events aren't content, stories are.",
  },
  {
    icon: BookOpen,
    title: "Narrative",
    desc: "A brief becomes the single source of truth for every channel.",
  },
  {
    icon: Share2,
    title: "Channels",
    desc: "LinkedIn, X, and a SEO/GEO-ready blog post — written last.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-slop gate",
    desc: "An editor rejects anything a generic model could've written.",
    gate: true,
  },
];

const STATS = [
  ["6", "grounded agents per signal"],
  ["100%", "claims traced to cited proof"],
  ["0", "blank-page prompts"],
  ["3", "channels from one signal"],
] as const;

const SHOTS = [
  ["/marketing/dashboard.png", "Dashboard — your signals and their status"],
  ["/marketing/signal-ready.png", "A finished signal with cited proof and ready assets"],
  ["/marketing/knowledge.png", "Company Knowledge — the proof the pipeline cites"],
  ["/marketing/analytics.png", "Per-agent cost and quality analytics"],
] as const;

const FAQ = [
  ["Why does this sound less like AI?", "Because it writes last. Every stage is grounded in your founder beliefs, brand voice, editorial strategy, and cited company knowledge before a single word is written — then an anti-slop editor gates the output."],
  ["Do I have to write the content myself?", "No. You submit a short signal; the pipeline produces LinkedIn, X, and blog drafts you review, edit, copy, export, or schedule."],
  ["What makes the output 'grounded'?", "A retrieval step pulls proof from your own knowledge store and the brief records which claims are backed by sources — ungrounded claims are flagged."],
  ["Can I bring signals in automatically?", "Yes — connect Pipedrive, Attio, Linear, GitHub, or any tool via a generic webhook, and qualifying events become signals automatically."],
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-base font-bold tracking-tight">SignalStory</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          {/* Subtle background wash + grid */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--brand)/0.10),transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                Context first. Writing last.
              </span>
            </div>
            <h1 className="mt-6 animate-fade-up text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Turn company momentum into{" "}
              <span className="text-brand">thought leadership.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-muted-foreground">
              Most AI content feels like AI because it starts with writing. Great
              content starts with context. SignalStory detects meaningful signals,
              finds the story, builds the narrative, and writes last — gated by an
              anti-slop editor so it sounds like a founder, not a model.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>

          {/* Trust stats bar */}
          <div className="border-t bg-card/60">
            <dl className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-border md:grid-cols-4">
              {STATS.map(([value, label]) => (
                <div key={label} className="px-6 py-6 text-center">
                  <dt className="text-3xl font-extrabold tracking-tight text-foreground">
                    {value}
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-muted-foreground">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Problem */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight">
              AI content is generic because it starts with writing.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Prompt a model with a blank page and you get blank-page output:
              fluent, confident, and indistinguishable from everyone else using
              the same model. The fix isn't a better prompt — it's grounding every
              decision in proprietary context before any writing happens.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand">
                The pipeline
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Six grounded agents that write last
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every stage is anchored in your context before the next begins.
                Two gates make sure only signal — never slop — reaches the page.
              </p>
            </div>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className={`group relative rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md ${
                      step.gate ? "border-brand/40 ring-1 ring-brand/15" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                          step.gate
                            ? "bg-brand text-brand-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 flex items-center gap-2 font-semibold">
                      {step.title}
                      {step.gate && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                          Gate
                        </span>
                      )}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Grounding / moat highlight */}
        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 md:grid-cols-3">
            {[
              {
                icon: BookOpen,
                title: "Grounded in your knowledge",
                desc: "A retrieval step cites proof from your own company knowledge store. Every claim is traced to a source — ungrounded ones are flagged.",
              },
              {
                icon: Search,
                title: "Context is the moat",
                desc: "Founder beliefs, brand voice, and editorial strategy shape each stage — so the output reflects you, not the model's defaults.",
              },
              {
                icon: Plug,
                title: "Signals on autopilot",
                desc: "Connect Pipedrive, Attio, Linear, GitHub, or any tool via webhook. Qualifying events become signals automatically.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Screenshots */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              See it in action
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {SHOTS.map(([src, alt]) => (
                <figure
                  key={src}
                  className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={alt} loading="lazy" className="w-full" />
                  <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
                    {alt}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Simple, usage-based pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Start free. Upgrade when you need more signals per month.
            </p>
            <div className="mt-12">
              <PricingTiers />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Frequently asked
            </h2>
            <div className="mt-10 space-y-4">
              {FAQ.map(([q, a]) => (
                <div key={q} className="rounded-xl border bg-card p-6 shadow-sm">
                  <h3 className="flex items-start gap-2 font-semibold">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {q}
                  </h3>
                  <p className="mt-2 pl-6 text-sm leading-relaxed text-muted-foreground">
                    {a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t bg-navy text-navy-foreground">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Stop sounding like everyone else's AI.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-navy-foreground/70">
              Submit your first signal and watch context — not a blank page — drive
              founder-quality content.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
