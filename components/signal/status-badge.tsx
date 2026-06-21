import { Badge } from "@/components/ui/badge";

const MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }
> = {
  QUEUED: { label: "Queued", variant: "secondary" },
  NORMALIZING: { label: "Normalizing", variant: "secondary" },
  SCORING: { label: "Scoring", variant: "secondary" },
  STORY: { label: "Finding story", variant: "secondary" },
  NARRATIVE: { label: "Building narrative", variant: "secondary" },
  CHANNEL: { label: "Writing", variant: "secondary" },
  EDITING: { label: "Anti-slop review", variant: "secondary" },
  READY: { label: "Ready", variant: "success" },
  REJECTED: { label: "Not worth publishing", variant: "warning" },
  FAILED: { label: "Failed", variant: "destructive" },
};

const ACTIVE = new Set([
  "QUEUED",
  "NORMALIZING",
  "SCORING",
  "STORY",
  "NARRATIVE",
  "CHANNEL",
  "EDITING",
]);

export function isTerminalStatus(status: string): boolean {
  return !ACTIVE.has(status);
}

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
