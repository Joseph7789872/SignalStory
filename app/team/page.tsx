import { TeamManager } from "@/components/team/team-manager";

export const dynamic = "force-dynamic";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates to this workspace. An invite is accepted automatically
          when the invited email signs in — no email delivery needed.
        </p>
      </div>
      <TeamManager />
    </div>
  );
}
