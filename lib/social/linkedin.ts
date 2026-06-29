// LinkedIn OAuth 2.0 + UGC post publishing. All network calls via fetch; no
// client is constructed at import time, so the app builds/runs without the
// LinkedIn env. Posting requires the "Sign In with LinkedIn (OIDC)" + "Share on
// LinkedIn" products approved and the `w_member_social` scope (external gate).

import crypto from "crypto";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";
export const LINKEDIN_SCOPES = "openid profile w_member_social";

export function isLinkedInConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export function redirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/oauth/linkedin/callback`;
}

// --- CSRF state binding ----------------------------------------------------
// The OAuth `state` must be tied to the user+org that started the flow, so an
// attacker cannot graft their own LinkedIn authorization onto a victim's org.
// We mint a random nonce as the `state` sent to LinkedIn, and store a cookie
// binding `nonce.userId.orgId` with an HMAC. The callback re-derives the
// authenticated context and requires it to match the binding.

function stateSecret(): string {
  // Reuse the app encryption key as the HMAC key (already required at runtime).
  const s = process.env.ENCRYPTION_KEY;
  if (!s) throw new Error("ENCRYPTION_KEY is required for OAuth state binding");
  return s;
}

export function signOAuthState(nonce: string, userId: string, orgId: string): string {
  const payload = `${nonce}.${userId}.${orgId}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Returns true iff `cookieValue` is a valid binding for `nonce`/`userId`/`orgId`. */
export function verifyOAuthState(
  cookieValue: string,
  nonce: string,
  userId: string,
  orgId: string,
): boolean {
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return false;
  const [cNonce, cUser, cOrg, cSig] = parts;
  if (cNonce !== nonce || cUser !== userId || cOrg !== orgId) return false;
  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(`${cNonce}.${cUser}.${cOrg}`)
    .digest("hex");
  const a = Buffer.from(cSig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    state,
    scope: LINKEDIN_SCOPES,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
  scopes: string;
};

export async function exchangeCode(code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed (HTTP ${res.status})`);
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
    scopes: j.scope ?? LINKEDIN_SCOPES,
  };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`LinkedIn token refresh failed (HTTP ${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: j.access_token, expiresIn: j.expires_in };
}

export async function getMe(accessToken: string): Promise<{ urn: string; name: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`LinkedIn userinfo failed (HTTP ${res.status})`);
  const j = (await res.json()) as { sub: string; name?: string };
  return { urn: `urn:li:person:${j.sub}`, name: j.name ?? "" };
}

/** Publish a plain-text share. Returns the created post id/URN. */
export async function publishText(
  accessToken: string,
  authorUrn: string,
  text: string,
): Promise<{ id: string }> {
  const res = await fetch(UGC_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LinkedIn publish failed (HTTP ${res.status}) ${detail.slice(0, 300)}`);
  }
  const id = res.headers.get("x-restli-id") ?? "";
  return { id };
}
