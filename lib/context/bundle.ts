import { prisma } from "@/lib/db";

// Loose shapes for the JSON columns (owned here + by the context UI).
type Framework = { name: string; summary: string };
type WritingSample = { label: string; text: string };
type NamedDesc = { name: string; description: string };

function section(title: string, body: string): string {
  return body.trim() ? `## ${title}\n${body.trim()}\n` : "";
}

function list(items: string[]): string {
  return items
    .filter((s) => s && s.trim())
    .map((s) => `- ${s.trim()}`)
    .join("\n");
}

/**
 * Builds a deterministic context string (stable ordering → cacheable prefix).
 * This is the moat: every agent reasons against it.
 */
export async function buildContextBundle(orgId: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      profile: true,
      founder: true,
      brandVoice: true,
      editorial: true,
      // Ordered for a stable (cacheable) prefix.
      customerVoice: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });

  const p = org.profile;
  const f = org.founder;
  const b = org.brandVoice;
  const e = org.editorial;
  const voice = org.customerVoice ?? [];

  const beliefs = (f?.beliefs as string[] | undefined) ?? [];
  const frameworks = (f?.frameworks as Framework[] | undefined) ?? [];
  const lessons = (f?.lessons as string[] | undefined) ?? [];
  const samples = (f?.writingSamples as WritingSample[] | undefined) ?? [];
  const pillars = (e?.pillars as NamedDesc[] | undefined) ?? [];
  const audiences = (e?.audiences as NamedDesc[] | undefined) ?? [];
  const vocab =
    (b?.vocabulary as { prefer?: string[]; avoid?: string[] } | undefined) ??
    {};

  const parts = [
    `# COMPANY CONTEXT — ${org.name}`,
    "This is proprietary context. Ground every judgment and every sentence in it. Generic claims that ignore this context are failures.",
    "",
    section(
      "Company",
      [
        p?.description && `What we do: ${p.description}`,
        p?.category && `Category: ${p.category}`,
        p?.icp && `Ideal customer: ${p.icp}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    section("Founder beliefs", list(beliefs)),
    section(
      "Founder frameworks",
      frameworks.map((fr) => `- ${fr.name}: ${fr.summary}`).join("\n"),
    ),
    section("Lessons learned", list(lessons)),
    section(
      "Editorial strategy",
      [
        pillars.length &&
          `Content pillars:\n${pillars
            .map((x) => `  - ${x.name}: ${x.description}`)
            .join("\n")}`,
        audiences.length &&
          `Audiences:\n${audiences
            .map((x) => `  - ${x.name}: ${x.description}`)
            .join("\n")}`,
        e?.goals?.length && `Goals: ${e.goals.join(", ")}`,
        e?.topicsToAvoid?.length &&
          `Topics to avoid: ${e.topicsToAvoid.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    section(
      "Brand voice",
      [
        b?.tone && `Tone: ${b.tone}`,
        b?.sentenceStyle && `Sentence style: ${b.sentenceStyle}`,
        b?.opinionatedness && `Opinionatedness: ${b.opinionatedness}`,
        b?.technicalDepth && `Technical depth: ${b.technicalDepth}`,
        vocab.prefer?.length && `Prefer words: ${vocab.prefer.join(", ")}`,
        vocab.avoid?.length && `Avoid words: ${vocab.avoid.join(", ")}`,
        b?.bannedPhrases?.length &&
          `BANNED phrases (never use): ${b.bannedPhrases.join(" | ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    samples.length
      ? section(
          "Founder writing samples (match this voice)",
          samples.map((s) => `### ${s.label}\n${s.text}`).join("\n\n"),
        )
      : "",
    voice.length
      ? section(
          "Customer voice (real language — prefer these phrasings over generic ones)",
          voice
            .map((v) => `- [${v.kind}] "${v.text}"${v.source ? ` (${v.source})` : ""}`)
            .join("\n"),
        )
      : "",
  ];

  return parts.filter(Boolean).join("\n");
}

/** 0-100 heuristic of how filled-in the context is (for onboarding nudges). */
export async function contextCompleteness(orgId: string): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { profile: true, founder: true, brandVoice: true, editorial: true },
  });
  let score = 0;
  if (org.profile?.description) score += 20;
  if (((org.founder?.beliefs as string[]) ?? []).length) score += 25;
  if (((org.founder?.writingSamples as unknown[]) ?? []).length) score += 20;
  if (org.brandVoice?.tone) score += 15;
  if (((org.editorial?.pillars as unknown[]) ?? []).length) score += 20;
  return Math.min(100, score);
}
