import { Suspense } from "react";

import { IntegrationManager } from "@/components/integrations/integration-manager";
import { SocialAccounts } from "@/components/social/social-accounts";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automated ingestion"
        title="Integrations"
        description="Connect a tool and SignalStory listens for content-worthy events automatically — no more typing signals by hand. Connect a source, paste the generated webhook URL into the provider, and real activity flows straight into the pipeline (the significance gate filters the noise)."
      />

      <Suspense>
        <SocialAccounts />
      </Suspense>

      <IntegrationManager />
    </div>
  );
}
