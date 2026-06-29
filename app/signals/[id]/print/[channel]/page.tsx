import { notFound } from "next/navigation";
import type { Channel } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { toHtml, type ChannelKey } from "@/lib/content/serialize";
import { PrintButton } from "@/components/signal/print-button";

// Org-scoped, print-optimized standalone view of one asset. Users "Save as PDF"
// from the browser print dialog (no headless-browser dependency).
export const dynamic = "force-dynamic";

const VALID: ChannelKey[] = ["LINKEDIN_FOUNDER", "X_THREAD", "BLOG_POST"];

const PRINT_CSS = `
.prose { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.5rem; line-height: 1.65; }
.prose h1 { font-size: 1.9rem; font-weight: 700; margin: 0 0 1rem; }
.prose h2 { font-size: 1.3rem; font-weight: 600; margin: 1.6rem 0 .6rem; }
.prose p { margin: 0 0 1rem; }
.prose ul, .prose ol { margin: 0 0 1rem 1.25rem; }
.prose blockquote { border-left: 3px solid #ddd; margin: 0 0 1rem; padding-left: 1rem; color: #555; }
.toolbar { max-width: 46rem; margin: 1rem auto 0; padding: 0 1.5rem; }
@media print { .no-print { display: none !important; } .prose { padding-top: .5rem; } }
`;

export default async function PrintAssetPage(
  props: {
    params: Promise<{ id: string; channel: string }>;
  }
) {
  const params = await props.params;
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    notFound();
  }

  const channel = params.channel as ChannelKey;
  if (!VALID.includes(channel)) notFound();

  const asset = await prisma.contentAsset.findFirst({
    where: {
      channel: channel as Channel,
      signalId: params.id,
      signal: { orgId: ctx!.org.id },
    },
  });
  if (!asset) notFound();

  const body = (asset.editedBody ?? asset.body) as unknown;
  const html = toHtml(channel, body);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="toolbar no-print">
        <PrintButton />
      </div>
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
