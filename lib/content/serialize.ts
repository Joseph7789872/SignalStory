import { marked } from "marked";

import { buildBlogJsonLd } from "@/lib/seo/jsonld";
import type { LinkedinFounder, XThread, BlogPost } from "@/lib/agents/schemas";

// Pure, isomorphic channel serializers — used by the asset card (copy/export),
// the print view, and the offline unit test. Source of truth per asset is
// `asset.editedBody ?? asset.body`. Channel matches the Prisma `Channel` enum.

export type ChannelKey = "LINKEDIN_FOUNDER" | "X_THREAD" | "BLOG_POST";

const li = (b: unknown) => b as LinkedinFounder;
const xt = (b: unknown) => b as XThread;
const bp = (b: unknown) => b as BlogPost;

function hashtagLine(tags: string[] | undefined): string {
  if (!tags?.length) return "";
  return tags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
}

/** Clean, paste-ready text for the destination network. */
export function toPlainText(channel: ChannelKey, body: unknown): string {
  if (channel === "LINKEDIN_FOUNDER") {
    const b = li(body);
    return [b.hook, b.body, b.takeaway, hashtagLine(b.hashtags)]
      .filter(Boolean)
      .join("\n\n");
  }
  if (channel === "X_THREAD") {
    const tweets = xt(body).tweets ?? [];
    return tweets.map((t, i) => `${i + 1}/ ${t}`).join("\n\n");
  }
  const b = bp(body);
  return [b.h1, b.tldr, b.bodyMarkdown].filter(Boolean).join("\n\n");
}

/** The body as Markdown WITHOUT frontmatter (shared by toMarkdown + toHtml). */
function markdownBody(channel: ChannelKey, body: unknown): string {
  if (channel === "LINKEDIN_FOUNDER") {
    const b = li(body);
    const parts = [b.hook, b.body, b.takeaway ? `*${b.takeaway}*` : ""];
    const tags = hashtagLine(b.hashtags);
    if (tags) parts.push(tags);
    return parts.filter(Boolean).join("\n\n");
  }
  if (channel === "X_THREAD") {
    const tweets = xt(body).tweets ?? [];
    return tweets.map((t, i) => `${i + 1}. ${t}`).join("\n");
  }
  const b = bp(body);
  const parts: string[] = [];
  if (b.h1) parts.push(`# ${b.h1}`);
  if (b.tldr) parts.push(`> **TL;DR** ${b.tldr}`);
  if (b.bodyMarkdown) parts.push(b.bodyMarkdown);
  if (b.keyTakeaways?.length) {
    parts.push(
      ["## Key takeaways", ...b.keyTakeaways.map((t) => `- ${t}`)].join("\n"),
    );
  }
  if (b.faq?.length) {
    parts.push(
      [
        "## FAQ",
        ...b.faq.map((f) => `**${f.question}**\n\n${f.answer}`),
      ].join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

/** Full Markdown export (blog gets YAML frontmatter for static-site pipelines). */
export function toMarkdown(channel: ChannelKey, body: unknown): string {
  const md = markdownBody(channel, body);
  if (channel !== "BLOG_POST") return md;
  const b = bp(body);
  const fm = [
    "---",
    `title: ${JSON.stringify(b.seoTitle ?? b.h1 ?? "")}`,
    `slug: ${b.slug ?? ""}`,
    `description: ${JSON.stringify(b.metaDescription ?? b.tldr ?? "")}`,
    ...(b.primaryKeyword ? [`primaryKeyword: ${JSON.stringify(b.primaryKeyword)}`] : []),
    "---",
    "",
  ].join("\n");
  return fm + md;
}

/** Standalone HTML (blog appends schema.org JSON-LD via buildBlogJsonLd). */
export function toHtml(channel: ChannelKey, body: unknown): string {
  const inner = marked.parse(markdownBody(channel, body), { async: false }) as string;
  if (channel !== "BLOG_POST") return inner;
  const jsonLd = JSON.stringify(buildBlogJsonLd(bp(body)), null, 2);
  return `${inner}\n<script type="application/ld+json">\n${jsonLd}\n</script>`;
}

/** A filename for a download/export (blog uses its slug). */
export function exportFilename(channel: ChannelKey, body: unknown, ext: string): string {
  if (channel === "BLOG_POST") {
    const slug = bp(body).slug?.trim();
    return `${slug || "blog-post"}.${ext}`;
  }
  return `${channel.toLowerCase()}.${ext}`;
}
