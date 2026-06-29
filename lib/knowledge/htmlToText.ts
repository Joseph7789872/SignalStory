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
 * Throws on HTTP/network failure — callers should map to a 422.
 */
export async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "SignalStoryBot/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Could not fetch URL (HTTP ${res.status})`);
  return htmlToText(await res.text()).slice(0, 200_000);
}
