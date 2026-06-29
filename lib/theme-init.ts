/**
 * Pre-paint theme initializer. Runs as an inline <script> in app/layout.tsx to
 * set the `dark` class before first paint (avoids a flash of the wrong theme).
 *
 * It's a STATIC inline script, so it can't carry a per-request CSP nonce without
 * forcing every page into dynamic rendering. Instead the CSP allows it by the
 * sha256 hash of this exact string (see lib/supabase/middleware.ts). Both the
 * <script> and the hash import THIS constant, so they can never drift apart.
 * If you edit the body below, the hash is recomputed automatically — no manual
 * hash to update.
 */
export const THEME_INIT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;
