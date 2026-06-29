import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCode, getMe, verifyOAuthState } from "@/lib/social/linkedin";
import { writeAudit } from "@/lib/audit";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

// Always clear the one-time state cookie on every exit path (prevents replay).
function back(status: "connected" | "error", msg?: string): NextResponse {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const u = new URL(`${base}/integrations`);
  u.searchParams.set("linkedin", status);
  if (msg) u.searchParams.set("msg", msg);
  const res = NextResponse.redirect(u.toString());
  res.cookies.set("li_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err || !code || !state) return back("error", err ?? "missing_code");

  const cookieState = req.headers.get("cookie")?.match(/li_oauth_state=([^;]+)/)?.[1];
  if (!cookieState) return back("error", "state_mismatch");

  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return back("error", "not_signed_in");
  }

  // CSRF: the signed state cookie must be bound to THIS user+org and the nonce
  // LinkedIn echoed back. Defeats login-CSRF / token-fixation across tenants.
  if (!verifyOAuthState(cookieState, state, ctx.user.id, ctx.org.id)) {
    return back("error", "state_mismatch");
  }

  try {
    const tok = await exchangeCode(code);
    const me = await getMe(tok.accessToken);
    const expiresAt = new Date(Date.now() + tok.expiresIn * 1000);
    const data = {
      externalId: me.urn,
      displayName: me.name,
      accessToken: encryptSecret(tok.accessToken),
      refreshToken: tok.refreshToken ? encryptSecret(tok.refreshToken) : null,
      expiresAt,
      scopes: tok.scopes,
      status: "ACTIVE",
    };
    await prisma.socialAccount.upsert({
      where: { orgId_provider: { orgId: ctx.org.id, provider: "LINKEDIN" } },
      create: { orgId: ctx.org.id, provider: "LINKEDIN", createdById: ctx.user.id, ...data },
      update: data,
    });
    writeAudit({
      orgId: ctx.org.id,
      actor: ctx.user,
      action: "linkedin.connected",
      resourceType: "SocialAccount",
      metadata: { displayName: me.name },
    });
    const res = back("connected");
    res.cookies.set("li_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    logError("linkedin.callback", e, { orgId: ctx.org.id });
    return back("error", "exchange_failed");
  }
}
