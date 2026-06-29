import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAN_IDS, PLANS } from "@/lib/billing/plans";

const FEATURES = [
  "LinkedIn, X & blog assets",
  "Company Knowledge RAG + cited proof",
  "Anti-slop editorial gate",
] as const;

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
              className={`relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow ${
                highlighted
                  ? "border-brand shadow-brand ring-1 ring-brand/20"
                  : "border-border shadow-sm hover:shadow-md"
              }`}
            >
              {highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-foreground shadow-sm">
                  Most popular
                </span>
              )}
              <h3 className="text-base font-semibold text-muted-foreground">
                {plan.label}
              </h3>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight">
                  ${plan.priceUsd}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </p>
              <div className="mt-5 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="font-bold text-foreground">
                  {plan.monthlySignals}
                </span>{" "}
                <span className="text-muted-foreground">signals / month</span>
              </div>
              <ul className="mt-5 flex-1 space-y-3 text-sm">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
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
