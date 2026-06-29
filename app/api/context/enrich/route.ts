import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { fetchUrlText } from "@/lib/knowledge/htmlToText";
import { runCompanyEnricher } from "@/lib/agents/companyEnricher";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

const Input = z.object({ url: z.string().url().max(2_000) });

// POST { url } → scrape + LLM-extract a context suggestion (NOT saved). The user
// reviews and saves via the existing partial PUT /api/context.
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`enrich:${ctx.org.id}`, "enrich");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many enrichment requests", retryAfter: rl.retryAfter },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid url" }, { status: 400 });
  }

  let text: string;
  try {
    text = await fetchUrlText(parsed.data.url);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch URL", details: err instanceof Error ? err.message : String(err) },
      { status: 422 },
    );
  }
  if (text.trim().length < 80) {
    return NextResponse.json(
      { error: "That page had too little text to learn from" },
      { status: 422 },
    );
  }

  try {
    const suggestion = await runCompanyEnricher(text);
    return NextResponse.json({ suggestion });
  } catch (err) {
    logError("context.enrich", err, { orgId: ctx.org.id });
    return NextResponse.json(
      { error: "Couldn't analyze that page right now" },
      { status: 502 },
    );
  }
}
