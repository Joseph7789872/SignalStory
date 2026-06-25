import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PLAN_IDS, PLANS } from "@/lib/billing/plans";

/** Pricing grid rendered from the single plan catalogue. Reused on / and /pricing. */
export function PricingTiers() {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-3">
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
              <h3 className="text-lg font-semibold">{plan.label}</h3>
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
              <Button
                asChild
                className="mt-6"
                variant={highlighted ? "default" : "outline"}
              >
                <Link href="/sign-up">
                  {plan.priceUsd === 0 ? "Start free" : `Get ${plan.label}`}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Paid plans are billed monthly via Stripe and can be changed or canceled
        anytime from your workspace settings.
      </p>
    </div>
  );
}
