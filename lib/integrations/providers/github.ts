import crypto from "crypto";

import type {
  ConnectionConfig,
  IntegrationProviderAdapter,
  ProviderEvent,
  SignalRawInput,
  VerifyArgs,
} from "../types";

const DEFAULT_EVENTS = ["release.published"];

/** Verify GitHub's `x-hub-signature-256`: "sha256=" + HMAC-SHA256(secret, body). */
function verify({ rawBody, headers, secret }: VerifyArgs): boolean {
  if (!secret) return false;
  const header =
    headers["x-hub-signature-256"] ?? headers["X-Hub-Signature-256"];
  if (!header) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parse(rawBody: string, headers: Record<string, string>): ProviderEvent[] {
  // GitHub puts the event name in a header and the delivery id (dedup key) too.
  const ghEvent = headers["x-github-event"] ?? headers["X-GitHub-Event"];
  const delivery =
    headers["x-github-delivery"] ?? headers["X-GitHub-Delivery"];
  if (!ghEvent || !delivery) return [];
  // GitHub's DEFAULT content type is application/x-www-form-urlencoded, which
  // delivers the JSON as `payload=<urlencoded>`. Accept that and raw JSON alike.
  const ct = headers["content-type"] ?? headers["Content-Type"] ?? "";
  let json = rawBody;
  if (ct.includes("application/x-www-form-urlencoded") || rawBody.startsWith("payload=")) {
    const payload = new URLSearchParams(rawBody).get("payload");
    if (!payload) return [];
    json = payload;
  }
  const body = JSON.parse(json);
  const type = body?.action ? `${ghEvent}.${body.action}` : ghEvent;
  return [{ externalId: delivery, type, data: body }];
}

function shouldIngest(event: ProviderEvent, config: ConnectionConfig): boolean {
  const allow = config.events?.length ? config.events : DEFAULT_EVENTS;
  return allow.includes(event.type);
}

function toRawInput(event: ProviderEvent): SignalRawInput {
  const b = event.data as any;
  const rel = b?.release ?? {};
  const repo = b?.repository?.full_name ?? "";
  const version = rel.tag_name ?? rel.name ?? "a new release";

  if (event.type === "release.published") {
    return {
      title: `Shipped ${version}${repo ? ` (${repo})` : ""}`,
      description:
        `A new release was published${repo ? ` for ${repo}` : ""}: ${version}.` +
        (rel.body ? `\n\nRelease notes:\n${rel.body}` : ""),
      evidence: [
        rel.tag_name ? `Tag: ${rel.tag_name}` : "",
        rel.name ? `Name: ${rel.name}` : "",
        rel.prerelease ? "Prerelease" : "",
      ]
        .filter(Boolean)
        .join("; "),
      links: [rel.html_url].filter(Boolean),
      metadata: {
        provider: "github",
        type: event.type,
        externalId: event.externalId,
        repo,
      },
    };
  }

  return {
    title: `GitHub: ${event.type}`,
    description: `A GitHub ${event.type} event occurred${repo ? ` for ${repo}` : ""}.`,
    evidence: "",
    links: [],
    metadata: { provider: "github", type: event.type, externalId: event.externalId },
  };
}

export const githubAdapter: IntegrationProviderAdapter = {
  slug: "github",
  provider: "GITHUB",
  label: "GitHub",
  events: [{ type: "release.published", label: "release.published" }],
  verify,
  parse,
  shouldIngest,
  toRawInput,
};
