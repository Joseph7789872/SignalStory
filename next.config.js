/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. CSP is intentionally
// omitted here — a correct policy for this app (Supabase, Sentry, inline Next
// runtime, marked-rendered HTML) needs per-route nonces and browser testing;
// add it deliberately rather than shipping a policy that breaks the app. The
// headers below are safe defaults that need no per-route tuning.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  webpack: (config) => {
    // Node 24's undici uses private class fields webpack can't parse; externalize it.
    config.externals = [...(config.externals || []), "undici"];
    return config;
  },
  images: {
    // Only allow remote hosts actually used. (Removed stale img.clerk.com —
    // Clerk is not used; auth is Supabase.) Keep this list narrow: a broad
    // pattern turns the image optimizer into an SSRF/DoS vector.
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
