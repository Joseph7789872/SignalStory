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
  const supabase = createClient();
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
        },
      },
    },
    include: { org: true },
  });

  return { user, org: user.org };
}

/** Throws if unauthenticated — use in API routes after middleware. */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getOrCreateAuthContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
