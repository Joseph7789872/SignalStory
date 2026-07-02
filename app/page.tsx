import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { SignalCanvas } from "@/components/marketing/signal-canvas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUSES = [
  "QUEUED",
  "SCORING",
  "STORY",
  "NARRATIVE",
  "CHANNEL",
  "EDITING",
] as const;

const PROBLEMS = [
  {
    tag: "✕ GENERIC",
    title: "No point of view",
    desc: "Prompt-to-post tools don't know what your founder believes, so they fill the gap with the average opinion of the internet.",
  },
  {
    tag: "✕ UNGROUNDED",
    title: "No proof",
    desc: "Claims without customer stories, numbers, or specifics read as filler — because they are. Your audience can tell.",
  },
  {
    tag: "✕ INTERCHANGEABLE",
    title: "Anyone could have posted it",
    desc: "If a competitor could publish the same post by swapping the logo, it builds their category — not your company.",
  },
] as const;

const STEPS = [
  {
    title: "Capture the signal",
    desc: "Submit wins by hand, or connect Pipedrive, Attio, Linear, and GitHub — deals, launches, and milestones flow in automatically. Anything else pipes in through Zapier or Make.",
  },
  {
    title: "Ground it in your company",
    desc: "Every signal is matched against your founder's beliefs, brand voice, editorial strategy — and your knowledge library, cited so claims come with receipts.",
  },
  {
    title: "Think first, write last",
    desc: "Five agents score, angle, and structure the story before a single writing agent turns the brief into channel-native drafts.",
  },
  {
    title: "Review drafts with receipts",
    desc: "Publish-ready LinkedIn, X, and blog drafts land in your dashboard with the proof behind every claim. Approve, tweak, or regenerate a single channel.",
  },
] as const;

type Tier = "extraction" | "reasoning" | "writing";

const TIER_STYLES: Record<Tier, string> = {
  extraction: "border-border bg-muted text-muted-foreground",
  reasoning: "border-brand/25 bg-brand/10 text-brand",
  writing: "border-brand bg-brand text-brand-foreground",
};

const FEATURES = [
  {
    tag: "Integrations",
    title: "Your tools, connected once",
    desc: "Native Pipedrive, Attio, Linear, and GitHub connections — plus a generic webhook for HubSpot, Salesforce, Gong, Slack, and anything Zapier or Make can reach.",
  },
  {
    tag: "Knowledge library",
    title: "Content that cites its sources",
    desc: "Paste in case studies, changelogs, and past posts. Drafts pull from them with citations, and every claim shows whether it's backed by a real source.",
  },
  {
    tag: "Proof library",
    title: "See the receipts",
    desc: "Each draft ships with its evidence trail — which sources grounded it and which claims to double-check before you hit publish.",
  },
  {
    tag: "Channels",
    title: "Native to every channel",
    desc: "One brief becomes a hook-first LinkedIn post, a punchy X thread, and a long-form blog piece — restructured for each, never copy-pasted.",
  },
  {
    tag: "Rewrites",
    title: "Regenerate one channel, not all three",
    desc: "Don't like the thread? Rewrite just that channel from the same brief. The thinking is preserved — only the words re-run.",
  },
  {
    tag: "Analytics",
    title: "Know what every draft costs",
    desc: "Per-run cost tracking and prompt versioning, so you can see exactly what you spend and which instructions produce the best content.",
  },
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

function Stage({
  n,
  name,
  tier,
  writes,
  children,
}: {
  n: number;
  name: string;
  tier: Tier;
  writes?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pb-9 last:pb-0">
      <span
        className={`absolute -left-14 top-0.5 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-background font-mono text-sm font-semibold text-white shadow-[0_0_0_1px_hsl(var(--border))] ${
          writes ? "bg-brand" : "bg-navy"
        }`}
      >
        {n}
      </span>
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-lg font-bold tracking-tight">{name}</h3>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider ${TIER_STYLES[tier]}`}
        >
          {tier}
        </span>
      </div>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function Gate({
  label,
  title,
  desc,
  verdicts,
}: {
  label: string;
  title: string;
  desc: string;
  verdicts: readonly (readonly [string, "pass" | "retry" | "fail"])[];
}) {
  const verdictStyles = {
    pass: "border-success/25 bg-success/10 text-success",
    retry: "border-warning/30 bg-warning/10 text-warning",
    fail: "border-destructive/25 bg-destructive/10 text-destructive",
  } as const;
  return (
    <div className="relative mb-9 mt-1 rounded-lg border border-warning/30 bg-warning/5 p-5 before:absolute before:-left-[38px] before:top-6 before:h-0.5 before:w-[38px] before:bg-warning/40">
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-warning">
        {label}
      </span>
      <h4 className="mt-1 text-[15px] font-bold">{title}</h4>
      <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
        {desc}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {verdicts.map(([text, kind]) => (
          <span
            key={text}
            className={`rounded-full border px-2.5 py-1 font-mono text-[11.5px] font-semibold ${verdictStyles[kind]}`}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky header — navy to match the hero */}
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-navy/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              SignalStory
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-navy-foreground/80 hover:bg-sidebar-accent hover:text-white"
            >
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
        <section className="relative overflow-hidden bg-navy text-navy-foreground">
          <div className="mx-auto max-w-4xl px-6 pt-16 text-center sm:pt-24">
            <span className="animate-fade-up font-mono text-xs font-semibold uppercase tracking-[0.12em] text-brand-bright">
              B2B thought leadership, grounded in your company
            </span>
            <h1 className="mx-auto mt-6 max-w-[20ch] animate-fade-up text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Turn what your company{" "}
              <span className="text-brand-bright">does</span> into content only
              your founder could write.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-navy-foreground/70">
              SignalStory watches your company&apos;s signals — closed deals,
              shipped features, customer wins — and turns them into LinkedIn
              posts, threads, and blog articles in your founder&apos;s actual
              voice.{" "}
              <strong className="font-semibold text-navy-foreground">
                Six agents think before one writes
              </strong>
              , and nothing generic makes it past the anti-slop gate.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-sidebar-border bg-sidebar-accent/50 text-navy-foreground hover:bg-sidebar-accent hover:text-white"
              >
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>

            {/* Status strip — the pipeline's real statuses */}
            <div
              className="mt-12 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-wide"
              aria-label="Signal statuses"
            >
              {STATUSES.map((s) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-full border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-1 text-sidebar-muted">
                    {s}
                  </span>
                  <span className="text-sidebar-border">→</span>
                </span>
              ))}
              <span className="rounded-full border border-success-bright/35 bg-success/15 px-2.5 py-1 text-success-bright">
                READY
              </span>
            </div>
          </div>
          <SignalCanvas className="mt-5 block h-[170px] w-full" />
        </section>

        {/* Problem */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              The problem
            </span>
            <h2 className="mx-auto mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              AI content all sounds the same. Because it all starts the same
              way: writing.
            </h2>
            <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-xl border bg-card p-6 shadow-sm">
                  <span className="inline-block rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 font-mono text-xs font-bold text-destructive">
                    {p.tag}
                  </span>
                  <h3 className="mt-3 font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-11 max-w-2xl rounded-xl border border-l-4 border-l-brand bg-card p-6 text-left shadow-sm">
              <p className="font-medium leading-relaxed">
                SignalStory inverts the process:{" "}
                <span className="text-brand">writing is the last step</span>,
                not the first. Every draft is grounded in what your company
                believes, says, and can prove — before a single sentence is
                written.
              </p>
            </div>
          </div>
        </section>

        {/* How it works — 4 steps on navy */}
        <section className="bg-navy text-navy-foreground">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-bright">
              How it works
            </span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From signal to publish-ready in four moves.
            </h2>
            <ol className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-6"
                >
                  <span className="font-mono text-xs font-bold tracking-[0.08em] text-brand-bright">
                    0{i + 1}
                  </span>
                  <h3 className="mt-2.5 font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-navy-foreground/70">
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pipeline rail */}
        <section className="border-b">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              Under the hood
            </span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Six agents. Two quality gates. One writer.
            </h2>
            <p className="mt-4 max-w-[60ch] text-muted-foreground">
              Most tools ask one model to do everything at once. SignalStory
              splits the job into specialists — and puts a gate before the
              writing and a gate after it.
            </p>

            <div className="relative mt-12 pl-14 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-0.5 before:bg-border">
              <Stage n={1} name="Event Listener" tier="extraction">
                Turns the raw signal into clean, verifiable facts — what
                happened, who was involved, what can be proven.
              </Stage>
              <Stage n={2} name="Significance Scorer" tier="reasoning">
                Judges whether this signal deserves content at all, scored
                against your editorial strategy.
              </Stage>
              <Gate
                label="Gate 1 · Significance"
                title="Not everything deserves a post."
                desc="Weak signals are rejected here — with a note on what would change the verdict — instead of becoming forced, thin content."
                verdicts={[
                  ["significant → continues", "pass"],
                  ["weak → rejected, with reasons", "fail"],
                ]}
              />
              <Stage n={3} name="Story Finder" tier="reasoning">
                Generates competing story angles — the different lenses this
                signal could be told through — and ranks them for
                distinctiveness.
              </Stage>
              <Stage n={4} name="Narrative Strategist" tier="reasoning">
                Commits to one angle and builds the brief: the argument, the
                structure, and a ledger of claims — each marked supported or
                unsupported by your knowledge library.
              </Stage>
              <Stage n={5} name="Channel Transformer" tier="writing" writes>
                <strong className="text-foreground">
                  The first and only agent that writes prose.
                </strong>{" "}
                It turns the brief into a LinkedIn post, an X thread, and a
                blog piece — each shaped for how that channel is actually read.
              </Stage>
              <Stage n={6} name="Anti-Slop Editor" tier="reasoning">
                The adversarial last line. It scores every draft on one brutal
                question — <em>could a generic AI have written this without
                your context?</em>
              </Stage>
              <Gate
                label="Gate 2 · Anti-slop"
                title="Generic drafts don't ship."
                desc="A failing draft gets exactly one rewrite with the editor's notes. Still generic? It's flagged for your attention instead of quietly published."
                verdicts={[
                  ["passes → ready for review", "pass"],
                  ["fails once → one rewrite", "retry"],
                  ["fails twice → flagged for you", "fail"],
                ]}
              />
              <div className="relative flex items-center">
                <span className="absolute -left-12 h-6 w-6 rounded-full border-[3px] border-background bg-success shadow-[0_0_0_1px_hsl(var(--success)/0.3)]" />
                <span className="font-mono text-[13px] font-bold tracking-wide text-success">
                  READY — founder-quality drafts, waiting for your review
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              Features
            </span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Everything between the signal and the post.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand">
                    {f.tag}
                  </span>
                  <h3 className="mt-2 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Screenshots */}
        <section className="border-t">
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
        <section className="border-t bg-muted/30">
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
        <section className="border-t">
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
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-bright">
              Get started
            </span>
            <h2 className="mx-auto mt-3 max-w-[22ch] text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop publishing content anyone could have written.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-navy-foreground/70">
              Connect your tools, teach SignalStory your voice, and let the
              pipeline turn what your company actually does into thought
              leadership that sounds like you.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-xs text-sidebar-muted">
              6 agents · 2 gates · writes last
            </p>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
