import { LegalFooter } from "@/components/legal-footer";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { PublicHeader } from "@/components/marketing/public-header";

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
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">
            Pricing
          </span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            Plans that scale with your output
          </h1>
          <p className="mx-auto mt-4 text-lg text-muted-foreground">
            Start free. Upgrade when you need more signals per month. Every plan
            runs the full context-first pipeline and anti-slop editor.
          </p>
        </div>

        <div className="mt-14">
          <PricingTiers />
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
