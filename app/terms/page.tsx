import Link from "next/link";

import { LegalFooter } from "@/components/legal-footer";

// NOTE: Template copy — have counsel review before relying on this in production.
export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of Service — SignalStory" };

const LAST_UPDATED = "June 25, 2026";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Link
          href="/"
          className="text-sm font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          SignalStory
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. Acceptance</h2>
            <p>
              By creating an account or using SignalStory, you agree to these
              Terms. If you are using the service on behalf of an organization, you
              represent that you are authorized to bind that organization.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. The service</h2>
            <p>
              SignalStory processes the signals and context you provide to generate
              draft content. You are responsible for reviewing, editing, and
              deciding whether to publish any output before it is used.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. Accounts &amp; acceptable use</h2>
            <p>
              Keep your credentials secure and your account information accurate. Do
              not misuse the service, attempt to disrupt it, exceed plan limits
              through circumvention, or submit content you do not have the right to
              use.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Your content</h2>
            <p>
              You retain ownership of the content and context you submit and of the
              generated output. You grant us a limited license to process this
              content solely to provide the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Billing</h2>
            <p>
              Paid plans are billed monthly in advance via our payment processor.
              Plan limits apply per billing period. You can change or cancel your
              plan at any time; changes take effect according to your billing cycle.
              Fees are non-refundable except where required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Disclaimers &amp; liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any
              kind. AI-generated output may be inaccurate; you are responsible for
              verifying it. To the maximum extent permitted by law, our liability is
              limited to the amount you paid in the prior twelve months.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Termination</h2>
            <p>
              You may delete your organization at any time from settings. We may
              suspend or terminate access for violations of these Terms. On
              termination, your data is deleted as described in our{" "}
              <Link className="underline" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Changes &amp; contact</h2>
            <p>
              We may update these Terms; material changes will be communicated. For
              questions, email{" "}
              <a className="underline" href="mailto:legal@signalstory.app">
                legal@signalstory.app
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
