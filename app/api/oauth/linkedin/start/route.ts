import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { requireOwner } from "@/lib/auth";
import { authorizeUrl, isLinkedInConfigured } from "@/lib/social/linkedin";

export const dynamic = "force-dynamic";

// Owner starts the OAuth flow. Sets a CSRF state cookie, redirects to LinkedIn.
export async function GET() {
  try {
    await requireOwner();
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

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
