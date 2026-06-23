import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { contextCompleteness } from "@/lib/context/bundle";

export const dynamic = "force-dynamic";

const ShortText = z.string().max(500);
const MediumText = z.string().max(4_000);
const SampleText = z.string().max(6_000);

const ContextInput = z.object({
  profile: z
    .object({
      description: MediumText.optional(),
      icp: MediumText.optional(),
      category: ShortText.optional(),
    })
    .optional(),
  founder: z
    .object({
      name: ShortText.optional(),
      beliefs: z.array(MediumText).max(20).optional(),
      frameworks: z
        .array(z.object({ name: ShortText, summary: MediumText }))
        .max(20)
        .optional(),
      lessons: z.array(MediumText).max(30).optional(),
      writingSamples: z
        .array(z.object({ label: ShortText, text: SampleText }))
        .max(10)
        .optional(),
    })
    .optional(),
  brandVoice: z
    .object({
      tone: MediumText.optional(),
      sentenceStyle: MediumText.optional(),
      bannedPhrases: z.array(z.string().max(200)).max(100).optional(),
      vocabulary: z
        .object({
          prefer: z.array(z.string().max(100)).max(100).optional(),
          avoid: z.array(z.string().max(100)).max(100).optional(),
        })
        .optional(),
      opinionatedness: ShortText.optional(),
      technicalDepth: ShortText.optional(),
    })
    .optional(),
  editorial: z
    .object({
      pillars: z
        .array(z.object({ name: ShortText, description: MediumText }))
        .max(20)
        .optional(),
      audiences: z
        .array(z.object({ name: ShortText, description: MediumText }))
        .max(20)
        .optional(),
      goals: z.array(MediumText).max(30).optional(),
      topicsToAvoid: z.array(MediumText).max(100).optional(),
    })
    .optional(),
});

export async function GET() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.org.id },
    include: { profile: true, founder: true, brandVoice: true, editorial: true },
  });
  const completeness = await contextCompleteness(ctx.org.id);

  return NextResponse.json({
    profile: org.profile,
    founder: org.founder,
    brandVoice: org.brandVoice,
    editorial: org.editorial,
    completeness,
  });
}

export async function PUT(req: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ContextInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { profile, founder, brandVoice, editorial } = parsed.data;
  const orgId = ctx.org.id;

  await prisma.$transaction(async (tx) => {
    if (profile) {
      await tx.organizationProfile.upsert({
        where: { orgId },
        create: { orgId, ...profile },
        update: profile,
      });
    }
    if (founder) {
      await tx.founderProfile.upsert({
        where: { orgId },
        create: { orgId, ...founder },
        update: founder,
      });
    }
    if (brandVoice) {
      await tx.brandVoice.upsert({
        where: { orgId },
        create: { orgId, ...brandVoice },
        update: brandVoice,
      });
    }
    if (editorial) {
      await tx.editorialStrategy.upsert({
        where: { orgId },
        create: { orgId, ...editorial },
        update: editorial,
      });
    }
  });

  const completeness = await contextCompleteness(orgId);
  return NextResponse.json({ ok: true, completeness });
}