import dns from "dns/promises";
import net from "net";

/**
 * SSRF guard: reject hostnames that resolve to loopback/private/link-local/
 * reserved IP ranges so a user-supplied URL can't make the server read internal
 * services (cloud metadata, localhost admin ports, RFC1918 hosts).
 */
function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4 address.
    const m = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isBlockedIp(m[1]);
    return false;
  }
  return true; // not a literal IP → treat as blocked (we only pass resolved IPs)
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = u.hostname;
  // If the host is already a literal IP, validate it directly.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error("URL resolves to a blocked address");
    return u;
  }
  const records = await dns.lookup(host, { all: true });
  if (records.length === 0) throw new Error("URL host did not resolve");
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error("URL resolves to a blocked address");
  }
  return u;
}

/** Minimal, dependency-free HTML → text for fetched pages (blogs/changelogs). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch a URL and return extracted text (≤200k chars). 15s timeout, bot UA.
 * SSRF-guarded: validates the host (and every redirect hop) against private/
 * reserved IP ranges before connecting. Throws on HTTP/network/validation
 * failure — callers should map to a 422.
 */
export async function fetchUrlText(url: string): Promise<string> {
  let current = (await assertSafeUrl(url)).toString();
  let res: Response | undefined;
  // Follow redirects manually so each hop's resolved IP is re-validated
  // (defeats redirect-based SSRF; DNS rebinding is mitigated by re-resolving).
  for (let hop = 0; hop < 5; hop++) {
    res = await fetch(current, {
      headers: { "user-agent": "SignalStoryBot/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = await assertSafeUrl(new URL(loc, current).toString());
      current = next.toString();
      continue;
    }
    break;
  }
  if (!res) throw new Error("Could not fetch URL");
  if (res.status >= 300 && res.status < 400) {
    throw new Error("Too many redirects");
  }
  if (!res.ok) throw new Error(`Could not fetch URL (HTTP ${res.status})`);
  return htmlToText(await res.text()).slice(0, 200_000);
}
