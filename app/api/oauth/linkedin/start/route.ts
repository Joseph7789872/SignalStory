import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { requireOwner } from "@/lib/auth";
import { authorizeUrl, isLinkedInConfigured, signOAuthState } from "@/lib/social/linkedin";

export const dynamic = "force-dynamic";

// Owner starts the OAuth flow. Sets a CSRF state cookie bound to the current
// user+org, redirects to LinkedIn.
export async function GET() {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Owners only" : "Unauthorized" },
      { status: forbidden ? 403 : 401 },
    );
  }
  if (!isLinkedInConfigured()) {
    return NextResponse.json({ error: "LinkedIn is not configured" }, { status: 503 });
  }

  // `state` sent to LinkedIn is just the nonce; the cookie carries the signed
  // binding to (nonce, userId, orgId) that the callback verifies.
  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(nonce));
  res.cookies.set("li_oauth_state", signOAuthState(nonce, ctx.user.id, ctx.org.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
