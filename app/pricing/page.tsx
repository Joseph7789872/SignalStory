import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal-footer";
import { PLAN_IDS, PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing — SignalStory",
  description: "Simple plans that scale with how much content you produce.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <div className="text-center">
          <Link
            href="/"
            className="text-sm font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            SignalStory
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free. Upgrade when you need more signals per month. Every plan
            runs the full context-first pipeline and anti-slop editor.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            const highlighted = id === "STARTER";
            return (
              <div
                key={id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  highlighted ? "border-primary shadow-sm" : "border-border"
                }`}
              >
                <h2 className="text-lg font-semibold">{plan.label}</h2>
                <p className="mt-2">
                  <span className="text-3xl font-bold">${plan.priceUsd}</span>
                  <span className="text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">
                      {plan.monthlySignals}
                    </span>{" "}
                    signals / month
                  </li>
                  <li>LinkedIn, X &amp; blog assets</li>
                  <li>Company Knowledge RAG + cited proof</li>
                  <li>Anti-slop editorial gate</li>
                </ul>
                <Button asChild className="mt-6" variant={highlighted ? "default" : "outline"}>
                  <Link href="/sign-up">
                    {plan.priceUsd === 0 ? "Start free" : `Get ${plan.label}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Paid plans are billed monthly via Stripe and can be changed or canceled
          anytime from your workspace settings.
        </p>
      </main>
      <LegalFooter />
    </div>
  );
}
