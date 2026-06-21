import { PromptManager } from "@/components/prompts/prompt-manager";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prompts</h1>
        <p className="text-sm text-muted-foreground">
          Version each agent&apos;s instruction, activate a version, and see how
          versions perform by the human feedback on signals they ran. The active
          version overrides the in-code default within ~15s.
        </p>
      </div>
      <PromptManager />
    </div>
  );
}
