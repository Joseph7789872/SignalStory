import Link from "next/link";

import { LegalFooter } from "@/components/legal-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing — SignalStory",
  description: "Simple plans that scale with how much content you produce.",
  openGraph: {
    title: "Pricing — SignalStory",
    description: "Simple plans that scale with how much content you produce.",
  },
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

        <div className="mt-12">
          <PricingTiers />
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
