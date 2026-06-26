import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PIPELINE = [
  ["Signal", "You submit a real company moment — a launch, a win, a lesson."],
  ["Significance gate", "It's scored. Not everything is worth publishing; weak signals stop here."],
  ["Story", "We find the angle — events aren't content, stories are."],
  ["Narrative", "A brief becomes the single source of truth for every channel."],
  ["Channels", "LinkedIn, X, and a SEO/GEO-ready blog post — written last."],
  ["Anti-slop gate", "An editor rejects anything a generic model could've written."],
];

const SHOTS = [
  ["/marketing/dashboard.png", "Dashboard — your signals and their status"],
  ["/marketing/signal-ready.png", "A finished signal with cited proof and ready assets"],
  ["/marketing/knowledge.png", "Company Knowledge — the proof the pipeline cites"],
  ["/marketing/analytics.png", "Per-agent cost and quality analytics"],
];

const FAQ = [
  ["Why does this sound less like AI?", "Because it writes last. Every stage is grounded in your founder beliefs, brand voice, editorial strategy, and cited company knowledge before a single word is written — then an anti-slop editor gates the output."],
  ["Do I have to write the content myself?", "No. You submit a short signal; the pipeline produces LinkedIn, X, and blog drafts you review, edit, copy, export, or schedule."],
  ["What makes the output 'grounded'?", "A retrieval step pulls proof from your own knowledge store and the brief records which claims are backed by sources — ungrounded claims are flagged."],
  ["Can I bring signals in automatically?", "Yes — connect Pipedrive, Attio, Linear, GitHub, or any tool via a generic webhook, and qualifying events become signals automatically."],
];

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold uppercase tracking-widest">SignalStory</span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center sm:pt-20">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Turn company momentum into thought leadership.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Most AI content feels like AI because it starts with writing. Great
            content starts with context. SignalStory detects meaningful signals,
            finds the story, builds the narrative, and writes last — gated by an
            anti-slop editor so it sounds like a founder, not a model.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              AI content is generic because it starts with writing.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Prompt a model with a blank page and you get blank-page output:
              fluent, confident, and indistinguishable from everyone else using
              the same model. The fix isn't a better prompt — it's grounding every
              decision in proprietary context before any writing happens.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            A pipeline that writes last
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map(([title, desc], i) => (
              <div key={title} className="rounded-xl border p-5">
                <div className="text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Screenshots */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-2xl font-bold tracking-tight">
              See it in action
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {SHOTS.map(([src, alt]) => (
                <figure key={src} className="overflow-hidden rounded-xl border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={alt} loading="lazy" className="w-full" />
                  <figcaption className="px-4 py-2 text-xs text-muted-foreground">
                    {alt}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Simple, usage-based pricing
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Start free. Upgrade when you need more signals per month.
          </p>
          <div className="mt-10">
            <PricingTiers />
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-center text-2xl font-bold tracking-tight">
              Frequently asked
            </h2>
            <div className="mt-8 space-y-4">
              {FAQ.map(([q, a]) => (
                <div key={q} className="rounded-xl border bg-background p-5">
                  <h3 className="font-semibold">{q}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg">
                <Link href="/sign-up">Start free</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
