import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="The moat"
        title="Company knowledge"
        description="This is your company's memory — the more real proof you add, the more grounded and credible the generated content. Add case studies, changelogs, founder posts, call transcripts, and customer quotes so the pipeline can cite concrete evidence in every narrative brief."
      />
      <KnowledgeManager />
    </div>
  );
}
