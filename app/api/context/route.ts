import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/lib/auth";
import { contextCompleteness } from "@/lib/context/bundle";

export const dynamic = "force-dynamic";

const ContextInput = z.object({
  profile: z
    .object({
      description: z.string().optional(),
      icp: z.string().optional(),
      category: z.string().optional(),
    })
    .optional(),
  founder: z
    .object({
      name: z.string().optional(),
      beliefs: z.array(z.string()).optional(),
      frameworks: z
        .array(z.object({ name: z.string(), summary: z.string() }))
        .optional(),
      lessons: z.array(z.string()).optional(),
      writingSamples: z
        .array(z.object({ label: z.string(), text: z.string() }))
        .optional(),
    })
    .optional(),
  brandVoice: z
    .object({
      tone: z.string().optional(),
      sentenceStyle: z.string().optional(),
      bannedPhrases: z.array(z.string()).optional(),
      vocabulary: z
        .object({
          prefer: z.array(z.string()).optional(),
          avoid: z.array(z.string()).optional(),
        })
        .optional(),
      opinionatedness: z.string().optional(),
      technicalDepth: z.string().optional(),
    })
    .optional(),
  editorial: z
    .object({
      pillars: z
        .array(z.object({ name: z.string(), description: z.string() }))
        .optional(),
      audiences: z
        .array(z.object({ name: z.string(), description: z.string() }))
        .optional(),
      goals: z.array(z.string()).optional(),
      topicsToAvoid: z.array(z.string()).optional(),
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
