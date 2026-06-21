import type { BlogPost } from "@/lib/agents/schemas";

/**
 * Builds schema.org JSON-LD for a generated blog post: an `Article` plus a
 * `FAQPage` (when the post has FAQ items). Returned as an array of plain objects
 * ready to JSON.stringify into a <script type="application/ld+json"> tag — the
 * structured data that helps the post get rich results and get cited by AI
 * answer engines (GEO).
 */
export function buildBlogJsonLd(
  post: Partial<BlogPost>,
  opts?: { url?: string; author?: string; publisher?: string },
): Record<string, unknown>[] {
  const keywords = [post.primaryKeyword, ...(post.secondaryKeywords ?? [])]
    .filter(Boolean)
    .join(", ");

  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seoTitle ?? post.h1 ?? "",
    description: post.metaDescription ?? post.tldr ?? "",
    articleBody: post.bodyMarkdown ?? "",
    ...(post.wordCount ? { wordCount: post.wordCount } : {}),
    ...(keywords ? { keywords } : {}),
    ...(opts?.author
      ? { author: { "@type": "Person", name: opts.author } }
      : {}),
    ...(opts?.publisher
      ? { publisher: { "@type": "Organization", name: opts.publisher } }
      : {}),
    ...(opts?.url ? { url: opts.url, mainEntityOfPage: opts.url } : {}),
  };

  const faqItems = post.faq ?? [];
  if (!faqItems.length) return [article];

  const faqPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return [article, faqPage];
}
