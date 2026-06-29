import { PromptManager } from "@/components/prompts/prompt-manager";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompts"
        description="Version each agent's instruction, activate a version, and see how versions perform by the human feedback on signals they ran. The active version overrides the in-code default within ~15s."
      />
      <PromptManager />
    </div>
  );
}
