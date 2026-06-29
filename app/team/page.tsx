import { TeamManager } from "@/components/team/team-manager";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite teammates to this workspace. An invite is accepted automatically when the invited email signs in — no email delivery needed."
      />
      <TeamManager />
    </div>
  );
}
