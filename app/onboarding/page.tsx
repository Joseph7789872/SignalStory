import { AppShell } from "@/components/app-shell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">
            Welcome to SignalStory
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Set up your context
          </h1>
          <p className="mt-2 text-muted-foreground">
            SignalStory writes last. First, give it the context that makes
            content sound like you — not like a model. Five quick steps; you can
            skip and refine anytime.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </AppShell>
  );
}
