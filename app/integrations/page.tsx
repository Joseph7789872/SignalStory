import { Suspense } from "react";

import { IntegrationManager } from "@/components/integrations/integration-manager";
import { SocialAccounts } from "@/components/social/social-accounts";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect a tool and SignalStory listens for content-worthy events
          automatically — no more typing signals by hand. Connect a source, paste
          the generated webhook URL into the provider, and real activity flows
          straight into the pipeline (the significance gate filters the noise).
        </p>
      </div>

      <Suspense>
        <SocialAccounts />
      </Suspense>

      <IntegrationManager />
    </div>
  );
}
