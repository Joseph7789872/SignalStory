import { inngest } from "./client";
import { runPipeline, type StepRunner } from "@/lib/pipeline/orchestrator";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { contentReadyEmail, scheduledDigestEmail } from "@/lib/email/templates";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { publishText, refresh } from "@/lib/social/linkedin";
import { toPlainText } from "@/lib/content/serialize";
import { writeAudit } from "@/lib/audit";
import { logError } from "@/lib/log";

const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN_FOUNDER: "LinkedIn",
  X_THREAD: "X thread",
  BLOG_POST: "Blog post",
};

/**
 * Durable pipeline runner. Each agent stage in `runPipeline` is wrapped in
 * `step.run`, so Inngest memoizes completed stages and retries/resumes from the
 * stage that failed. We adapt Inngest's `step` to the orchestrator's small
 * StepRunner shape at the boundary (Inngest types the return as Jsonify<T>;
 * agent outputs are plain JSON, so erasing the wrapper here is safe).
 */
export const runPipelineFn = inngest.createFunction(
  { id: "run-pipeline", retries: 2, triggers: [{ event: "signal/submitted" }] },
  async ({ event, step }) => {
    const runner: StepRunner = {
      run: (id, fn) => step.run(id, fn as () => Promise<unknown>) as never,
    };
    const signalId = event.data.signalId as string;
    await runPipeline(signalId, runner);

    // Notify the human author when content is ready to review. Durable + once
    // (memoized step); skipped for auto-ingested signals (no userId) and when
    // the run didn't reach READY. Best-effort — sendEmail never throws.
    await step.run("notify-content-ready", async () => {
      const signal = await prisma.signal.findUnique({
        where: { id: signalId },
        select: {
          status: true,
          rawInput: true,
          user: { select: { email: true } },
          _count: { select: { assets: true } },
        },
      });
      if (signal?.status === "READY" && signal.user?.email) {
        const title =
          (signal.rawInput as { title?: string } | null)?.title ?? "Your signal";
        await sendEmail({
          to: signal.user.email,
          ...contentReadyEmail({
            signalId,
            title,
            assetCount: signal._count.assets,
          }),
        });
        return { notified: true };
      }
      return { notified: false };
    });

    return { signalId };
  },
);

/**
 * Daily reminder: email each org's owner the posts scheduled for today. Runs at
 * 13:00 UTC. Best-effort — sendEmail no-ops when Resend is unconfigured.
 */
export const scheduledPostsDigestFn = inngest.createFunction(
  { id: "scheduled-posts-digest", triggers: [{ cron: "0 13 * * *" }] },
  async ({ step }) => {
    const sent = await step.run("send-digests", async () => {
      const now = new Date();
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

      const due = await prisma.scheduledPost.findMany({
        where: { status: "SCHEDULED", scheduledFor: { gte: start, lt: end } },
        include: {
          asset: { select: { signal: { select: { rawInput: true } } } },
        },
        orderBy: { scheduledFor: "asc" },
      });

      // Group by org.
      const byOrg = new Map<string, typeof due>();
      for (const p of due) {
        const list = byOrg.get(p.orgId) ?? [];
        list.push(p);
        byOrg.set(p.orgId, list);
      }

      let count = 0;
      for (const [orgId, posts] of Array.from(byOrg.entries())) {
        const owner = await prisma.user.findFirst({
          where: { orgId, role: "OWNER" },
          select: { email: true },
        });
        if (!owner?.email) continue;
        const items = posts.map((p) => ({
          title:
            (p.asset.signal?.rawInput as { title?: string } | null)?.title ??
            "Signal",
          channel: CHANNEL_LABEL[p.channel] ?? p.channel,
          time: new Date(p.scheduledFor).toUTCString().slice(17, 22),
        }));
        await sendEmail({ to: owner.email, ...scheduledDigestEmail({ items }) });
        count += 1;
      }
      return { orgsNotified: count, postsDue: due.length };
    });

    return sent;
  },
);

/**
 * Auto-publish due LinkedIn posts. Runs every 5 minutes: each due ScheduledPost
 * with autopublish=true is posted via the LinkedIn API and flipped to POSTED.
 * Each post has its own try/catch so one failure can't block the batch. No-op
 * when LinkedIn is unconfigured (publishText will just error → publishError).
 */
export const publishDuePostsFn = inngest.createFunction(
  { id: "publish-due-posts", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    return await step.run("publish", async () => {
      const now = new Date();
      const due = await prisma.scheduledPost.findMany({
        where: {
          status: "SCHEDULED",
          autopublish: true,
          channel: "LINKEDIN_FOUNDER",
          scheduledFor: { lte: now },
        },
        include: { asset: { select: { body: true, editedBody: true } } },
        take: 50,
      });

      let posted = 0;
      let failed = 0;
      for (const post of due) {
        try {
          const account = await prisma.socialAccount.findUnique({
            where: { orgId_provider: { orgId: post.orgId, provider: "LINKEDIN" } },
          });
          if (!account || account.status === "REVOKED") {
            throw new Error("LinkedIn account not connected");
          }

          let token = decryptSecret(account.accessToken);
          // Refresh if within 5 minutes of expiry and a refresh token exists.
          if (account.expiresAt && account.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
            if (account.refreshToken) {
              const r = await refresh(decryptSecret(account.refreshToken));
              token = r.accessToken;
              await prisma.socialAccount.update({
                where: { id: account.id },
                data: {
                  accessToken: encryptSecret(token),
                  expiresAt: new Date(Date.now() + r.expiresIn * 1000),
                },
              });
            } else {
              await prisma.socialAccount.update({
                where: { id: account.id },
                data: { status: "EXPIRED" },
              });
              throw new Error("LinkedIn token expired — reconnect required");
            }
          }

          const body = post.asset.editedBody ?? post.asset.body;
          const text = toPlainText("LINKEDIN_FOUNDER", body);
          const { id } = await publishText(token, account.externalId, text);

          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: { status: "POSTED", postedAt: new Date(), publishError: null },
          });
          writeAudit({
            orgId: post.orgId,
            action: "post.published",
            resourceType: "ScheduledPost",
            resourceId: post.id,
            metadata: { provider: "LINKEDIN", externalId: id },
          });
          posted += 1;
        } catch (err) {
          failed += 1;
          logError("publish", err, { scheduledPostId: post.id });
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              attempts: { increment: 1 },
              publishError: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
      return { posted, failed, due: due.length };
    });
  },
);

export const functions = [runPipelineFn, scheduledPostsDigestFn, publishDuePostsFn];
