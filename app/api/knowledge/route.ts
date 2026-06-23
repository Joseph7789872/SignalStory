import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { MemoryKind } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { chunkText } from "@/lib/knowledge/chunk";
import { embed, toVectorLiteral } from "@/lib/agents/embeddings";

export const dynamic = "force-dynamic";

function ownerError(e: unknown) {
  const forbidden = e instanceof Error && e.message === "FORBIDDEN";
  return NextResponse.json(
    { error: forbidden ? "Owners only" : "Unauthorized" },
    { status: forbidden ? 403 : 401 },
  );
}

const KINDS = [
  "COMPANY_DOC",
  "CHANGELOG",
  "CASE_STUDY",
  "FOUNDER_POST",
  "CALL_TRANSCRIPT",
  "CUSTOMER_QUOTE",
  "OTHER",
] as const;

const CreateInput = z
  .object({
    kind: z.enum(KINDS).default("COMPANY_DOC"),
    title: z.string().min(1).max(200),
    sourceUrl: z.string().url().max(2_000).optional(),
    text: z.string().max(200_000).optional(),
  })
  .refine((v) => (v.text && v.text.trim().length >= 20) || v.sourceUrl, {
    message: "Provide text (≥20 chars) or a sourceUrl to fetch",
  });

/** Minimal, dependency-free HTML → text for fetched pages (blogs/changelogs). */
function htmlToText(html: string): string {
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

export async function GET() {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const docs = await prisma.memoryDoc.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      title: true,
      sourceUrl: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  });
  return NextResponse.json({
    role: ctx.user.role,
    docs: docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      sourceUrl: d.sourceUrl,
      createdAt: d.createdAt,
      chunks: d._count.chunks,
    })),
  });
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { kind, title, sourceUrl } = parsed.data;
  let text = parsed.data.text?.trim() ?? "";

  // Fetch + extract if only a URL was given.
  if (!text && sourceUrl) {
    try {
      const res = await fetch(sourceUrl, {
        headers: { "user-agent": "SignalStoryBot/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Could not fetch URL (HTTP ${res.status})` },
          { status: 422 },
        );
      }
      text = htmlToText(await res.text()).slice(0, 200_000);
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to fetch URL", details: err instanceof Error ? err.message : String(err) },
        { status: 422 },
      );
    }
  }
  if (text.trim().length < 20) {
    return NextResponse.json(
      { error: "Fetched/provided text was too short to index" },
      { status: 422 },
    );
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "Nothing to index" }, { status: 422 });
  }

  // Embed all chunks (OpenAI). Surface a clear error if the key is missing/bad.
  let vectors: number[][];
  try {
    ({ vectors } = await embed(chunks));
  } catch (err) {
    return NextResponse.json(
      { error: "Embedding failed", details: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const doc = await prisma.memoryDoc.create({
    data: {
      orgId: ctx.org.id,
      kind: kind as MemoryKind,
      title,
      sourceUrl: sourceUrl ?? null,
      rawText: text,
      createdById: ctx.user.id,
    },
  });

  // Prisma can't write the Unsupported vector column — insert chunks via raw SQL.
  for (let i = 0; i < chunks.length; i++) {
    const lit = toVectorLiteral(vectors[i]);
    await prisma.$executeRaw`
      INSERT INTO "MemoryChunk" (id, "docId", "orgId", ord, text, embedding, "createdAt")
      VALUES (${randomUUID()}, ${doc.id}, ${ctx.org.id}, ${i}, ${chunks[i]}, ${lit}::vector, now())
    `;
  }

  return NextResponse.json({ id: doc.id, chunks: chunks.length });
}

export async function DELETE(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    return ownerError(e);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  // Chunks cascade on the FK (onDelete: Cascade).
  await prisma.memoryDoc.deleteMany({ where: { id, orgId: ctx.org.id } });
  return NextResponse.json({ ok: true });
}
