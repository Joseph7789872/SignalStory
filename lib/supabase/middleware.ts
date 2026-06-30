import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { THEME_INIT } from "@/lib/theme-init";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// sha256 of the static theme-init inline script (app/layout.tsx). It's allowed
// in script-src by hash because a static <script> can't carry a per-request
// nonce without forcing dynamic rendering on every page. Computed once from the
// shared THEME_INIT constant (memoised) so it can never drift from the script.
let themeHashPromise: Promise<string> | null = null;
function themeScriptHash(): Promise<string> {
  if (!themeHashPromise) {
    themeHashPromise = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(THEME_INIT))
      .then(
        (buf) =>
          `'sha256-${btoa(String.fromCharCode(...new Uint8Array(buf)))}'`,
      );
  }
  return themeHashPromise;
}

// NB: /api/webhooks is intentionally NOT protected — third parties POST there
// with no Supabase session; those routes authenticate via signature + token.
const PROTECTED =
  /^\/(dashboard|signals|context|onboarding|analytics|prompts|integrations|knowledge|settings|calendar|audit|trash)(\/|$)|^\/api\/(signals|assets|context|analytics|prompts|integrations|knowledge|schedule|social|audit|trash)(\/|$)/;

/**
 * Per-request Content-Security-Policy. script-src uses a nonce + strict-dynamic
 * (Next auto-applies the nonce to its own scripts when it sees this header on
 * the request). style-src keeps 'unsafe-inline' — Next/Tailwind inject inline
 * styles and nonces on styles aren't practical. connect-src allows Supabase
 * (https + realtime wss) and Sentry. Dev relaxes script/connect for HMR/eval.
 */
async function contentSecurityPolicy(nonce: string): Promise<string> {
  const isDev = process.env.NODE_ENV !== "production";
  let supabaseHost = "";
  try {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    /* unset/invalid — connect-src just omits it */
  }
  const supabase = supabaseHost
    ? `https://${supabaseHost} wss://${supabaseHost}`
    : "";
  const themeHash = await themeScriptHash();

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${themeHash} 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabase} https://*.sentry.io https://*.ingest.sentry.io${isDev ? " ws: wss:" : ""}`
      .replace(/\s+/g, " ")
      .trim(),
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

/** Refreshes the Supabase session cookie, sets a nonce CSP, gates protected routes. */
export async function updateSession(request: NextRequest) {
  // Edge runtime: use Web Crypto + btoa (no Node Buffer).
  const nonce = btoa(crypto.randomUUID());
  const csp = await contentSecurityPolicy(nonce);

  // Pass the nonce + CSP on the request so Next can nonce its own scripts, and
  // a server component can read the nonce via headers().get("x-nonce").
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.test(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", path);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("content-security-policy", csp);
    return redirect;
  }

  response.headers.set("content-security-policy", csp);
  return response;
}
