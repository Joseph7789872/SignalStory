import { ContextForm } from "@/components/context/context-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="The moat"
        title="Context"
        description="Every agent reasons against this. The richer it is, the less generic your content."
      />
      <ContextForm />
    </div>
  );
}
