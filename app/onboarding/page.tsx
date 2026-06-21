import { AppShell } from "@/components/app-shell";
import { ContextForm } from "@/components/context/context-form";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Set up your context
          </h1>
          <p className="text-sm text-muted-foreground">
            SignalStory writes last. First, give it the context that makes
            content sound like you — not like a model. You can refine this
            anytime.
          </p>
        </div>
        <ContextForm redirectTo="/dashboard" />
      </div>
    </AppShell>
  );
}
