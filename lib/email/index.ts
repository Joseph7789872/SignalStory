import { Resend } from "resend";

// Lazy Resend client. When RESEND_API_KEY is unset, sendEmail is a no-op (warns
// once) so local dev, `next build`, and the e2e test run without email. Sending
// NEVER throws — callers treat email as best-effort and must not fail their
// request when delivery fails.

let client: Resend | null = null;
let warned = false;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

// Resend's shared sandbox sender works without domain verification for testing.
function from(): string {
  return process.env.EMAIL_FROM || "SignalStory <onboarding@resend.dev>";
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    if (!warned) {
      console.warn("[email] RESEND_API_KEY unset — emails disabled (no-op).");
      warned = true;
    }
    return { ok: false, skipped: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: from(),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
