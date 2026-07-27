import { LegalFooter } from "@/components/legal-footer";
import { PublicHeader } from "@/components/marketing/public-header";

// INTERNAL: Improved draft — counsel review still REQUIRED before launch.
// Not user-facing; do not surface this note in the rendered page.
export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy Policy" };

const LAST_UPDATED = "June 25, 2026";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-6 rounded-2xl border bg-card p-6 text-sm leading-relaxed text-foreground/90 shadow-sm sm:p-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Overview</h2>
            <p>
              SignalStory (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps companies turn
              internal signals into thought-leadership content. This policy
              explains what we collect, how we use it, and the choices you have.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account data:</strong> your email, name, and organization
                details, managed through our authentication provider.
              </li>
              <li>
                <strong>Content you provide:</strong> signals, founder/brand
                context, company knowledge documents, and any text you submit for
                processing.
              </li>
              <li>
                <strong>Company knowledge store:</strong> documents and URLs you
                add to the knowledge base (case studies, changelogs, transcripts,
                posts) are stored, chunked, and embedded so the pipeline can cite
                them. These may contain your intellectual property or personal
                data about your customers — only submit what you have the right
                to store. Knowledge documents are retained until you delete them
                from the Knowledge page or purge your organization.
              </li>
              <li>
                <strong>Auto-ingested events:</strong> if you connect an
                integration (Pipedrive, Attio, Linear, GitHub, or a generic
                webhook), the events those tools send us become signals in your
                workspace.
              </li>
              <li>
                <strong>Usage &amp; billing data:</strong> pipeline runs, costs,
                and subscription status needed to operate and bill the service.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How we use it</h2>
            <p>
              We use your data to run the content pipeline, provide and improve the
              service, enforce usage limits, process payments, and communicate with
              you (e.g. &ldquo;content ready&rdquo; notifications). We do
              not sell your personal data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Sub-processors</h2>
            <p>
              We share data with the following providers strictly to operate the
              service; each processes data only as needed to provide its function:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Supabase</strong> — database, authentication, file storage</li>
              <li><strong>OpenAI / Anthropic</strong> — LLM providers that process your signals, context, and knowledge excerpts to generate content and embeddings</li>
              <li><strong>Vercel</strong> — application hosting</li>
              <li><strong>Inngest</strong> — durable job queue for pipeline runs</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Resend</strong> — transactional email</li>
              <li><strong>Upstash</strong> — rate-limit store</li>
              <li><strong>Sentry</strong> — error monitoring</li>
              <li><strong>LinkedIn</strong> — only if you connect it, to publish posts you schedule</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Retention &amp; your rights (GDPR/CCPA)</h2>
            <p>
              We keep your data while your account is active. Deleted signals go
              to your workspace Trash before permanent removal; knowledge
              documents are removed immediately when you delete them. You can
              exercise your data rights self-serve:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Access / portability:</strong> export your entire
                organization as JSON from Settings (or <code>GET /api/account</code>).
              </li>
              <li>
                <strong>Erasure:</strong> permanently delete your organization and
                all of its data — signals, assets, context, knowledge store,
                connections — from Settings (or <code>DELETE /api/account</code>).
                Deletion cascades to every child record.
              </li>
            </ul>
            <p>For anything else, contact us at the address below.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Security</h2>
            <p>
              Connection secrets are encrypted at rest, access is scoped per
              organization, and transport is encrypted in transit. No method of
              storage or transmission is perfectly secure, but we work to protect
              your data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p>
              Questions about this policy? Email{" "}
              <a className="underline" href="mailto:privacy@signalstory.app">
                privacy@signalstory.app
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
