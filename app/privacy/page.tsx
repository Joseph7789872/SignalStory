import { LegalFooter } from "@/components/legal-footer";
import { PublicHeader } from "@/components/marketing/public-header";

// NOTE: Template copy — have counsel review before relying on this in production.
export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy Policy — SignalStory" };

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
              We share data with infrastructure providers strictly to operate the
              service: a database/auth host, large-language-model providers (to
              generate content), a payment processor, an email provider, a job
              queue, and a rate-limit store. Each processes data only as needed to
              provide their function.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Retention &amp; your rights</h2>
            <p>
              We keep your data while your account is active. You can export all of
              your organization&rsquo;s data, or permanently delete your
              organization and its data, from your workspace settings (or via our
              account API). For requests, contact us at the address below.
            </p>
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
