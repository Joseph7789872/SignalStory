import type { Organization, User } from "@prisma/client";

import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = { user: User; org: Organization };

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

/**
 * Lazily provisions the User + Organization on first authenticated request,
 * keyed to the Supabase auth user. Returns null when there is no session.
 */
export async function getOrCreateAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const existing = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { org: true },
  });
  if (existing) return { user: existing, org: existing.org };

  const email = authUser.email ?? `${authUser.id}@placeholder.local`;
  const name =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    null;

  // Invite-aware: if this email was invited to an existing org, join it instead
  // of provisioning a new workspace. Acceptance is implicit on first sign-in.
  // Require a CONFIRMED email first — otherwise someone could sign up with an
  // unverified address matching a pending invite and join another org's
  // workspace. Unconfirmed users fall through to their own (isolated) workspace.
  const emailConfirmed = Boolean(
    (authUser as { email_confirmed_at?: string | null }).email_confirmed_at ??
      (authUser as { confirmed_at?: string | null }).confirmed_at,
  );
  const invite = emailConfirmed
    ? await prisma.organizationInvite.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (invite) {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          authUserId: authUser.id,
          email,
          name,
          role: invite.role,
          orgId: invite.orgId,
        },
        include: { org: true },
      });
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      });
      return u;
    });
    return { user, org: user.org };
  }

  const baseSlug = slugify(name ?? email.split("@")[0]);
  const slug = `${baseSlug}-${authUser.id.slice(0, 6).toLowerCase()}`;

  const user = await prisma.user.create({
    data: {
      authUserId: authUser.id,
      email,
      name,
      role: "OWNER",
      org: {
        create: {
          name: name ? `${name}'s workspace` : "My workspace",
          slug,
          profile: { create: {} },
          founder: { create: { name: name ?? "" } },
          brandVoice: { create: {} },
          editorial: { create: {} },
          subscription: { create: {} }, // defaults to FREE
        },
      },
    },
    include: { org: true },
  });

  return { user, org: user.org };
}

/** Throws unless the caller is an OWNER — use for team-management actions. */
export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (ctx.user.role !== "OWNER") throw new Error("FORBIDDEN");
  return ctx;
}

/** Throws if unauthenticated — use in API routes after middleware. */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getOrCreateAuthContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
