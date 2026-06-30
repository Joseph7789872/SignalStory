// Plain-HTML transactional templates (no extra render deps). Each returns the
// subject + html + text passed straight to sendEmail.

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;margin:0;padding:24px;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:28px;">
      <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:0 0 12px;">SignalStory</p>
      <h1 style="font-size:20px;color:#111827;margin:0 0 12px;">${heading}</h1>
      <div style="font-size:14px;line-height:1.55;color:#374151;">${bodyHtml}</div>
      <p style="margin:24px 0 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:8px;">${ctaLabel}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;word-break:break-all;">Or paste this link: ${ctaUrl}</p>
    </td></tr>
  </table></body></html>`;
}

export function scheduledDigestEmail(opts: {
  items: { title: string; channel: string; time: string }[];
}): { subject: string; html: string; text: string } {
  const url = appUrl("/calendar");
  const n = opts.items.length;
  const rows = opts.items
    .map(
      (i) =>
        `<li><strong>${i.time}</strong> — ${escapeHtml(i.title)} <em>(${escapeHtml(
          i.channel,
        )})</em></li>`,
    )
    .join("");
  return {
    subject: `${n} post${n === 1 ? "" : "s"} scheduled for today`,
    html: layout(
      "Posts scheduled for today",
      `<p>You have ${n} post${n === 1 ? "" : "s"} to publish today:</p><ul>${rows}</ul>`,
      "Open calendar",
      url,
    ),
    text:
      `You have ${n} post(s) scheduled for today:\n` +
      opts.items.map((i) => `- ${i.time} — ${i.title} (${i.channel})`).join("\n") +
      `\n${url}`,
  };
}

export function contentReadyEmail(opts: {
  signalId: string;
  title: string;
  assetCount: number;
}): { subject: string; html: string; text: string } {
  const url = appUrl(`/signals/${opts.signalId}`);
  const title = escapeHtml(opts.title);
  const n = opts.assetCount;
  return {
    subject: `Content ready: ${opts.title}`,
    html: layout(
      "Your content is ready to review",
      `<p>SignalStory finished processing <strong>${title}</strong>${
        n > 0 ? ` and drafted ${n} asset${n === 1 ? "" : "s"}` : ""
      }. Review, edit, and approve it now.</p>`,
      "Review content",
      url,
    ),
    text: `Your content for "${opts.title}" is ready to review: ${url}`,
  };
}
