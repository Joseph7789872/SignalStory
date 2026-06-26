import { prisma } from "@/lib/db";
import { logError } from "@/lib/log";

// Append-only audit trail. Best-effort: never throws and never blocks the
// caller's response (fire-and-forget), mirroring lib/log.ts.

export type AuditActor = { id?: string; email?: string } | null | undefined;

export function writeAudit(args: {
  orgId: string;
  actor?: AuditActor;
  action: string; // e.g. "signal.deleted", "asset.approved", "linkedin.connected"
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): void {
  prisma.auditLog
    .create({
      data: {
        orgId: args.orgId,
        actorId: args.actor?.id ?? null,
        actorEmail: args.actor?.email ?? null,
        action: args.action,
        resourceType: args.resourceType ?? null,
        resourceId: args.resourceId ?? null,
        metadata: (args.metadata ?? {}) as object,
      },
    })
    .catch((err) => logError("audit", err, { action: args.action }));
}
