import { AppShell } from "@/components/app-shell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Set up your context
          </h1>
          <p className="text-sm text-muted-foreground">
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
