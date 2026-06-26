import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company knowledge</h1>
        <p className="text-sm text-muted-foreground">
          This is your company&apos;s memory — the more real proof you add, the more
          grounded and credible the generated content. Add case studies,
          changelogs, founder posts, call transcripts, and customer quotes so the
          pipeline can cite concrete evidence in every narrative brief.
        </p>
      </div>
      <KnowledgeManager />
    </div>
  );
}
