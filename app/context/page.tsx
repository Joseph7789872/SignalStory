import { ContextForm } from "@/components/context/context-form";

export const dynamic = "force-dynamic";

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Context</h1>
        <p className="text-sm text-muted-foreground">
          The moat. Every agent reasons against this. The richer it is, the less
          generic your content.
        </p>
      </div>
      <ContextForm />
    </div>
  );
}
