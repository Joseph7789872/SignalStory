import Link from "next/link";

import { LegalFooter } from "@/components/legal-footer";
import { PublicHeader } from "@/components/marketing/public-header";

// INTERNAL: Improved draft — counsel review still REQUIRED before launch.
// Not user-facing; do not surface this note in the rendered page.
export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of Service" };

const LAST_UPDATED = "June 25, 2026";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-6 rounded-2xl border bg-card p-6 text-sm leading-relaxed text-foreground/90 shadow-sm sm:p-8">
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
            <h2 className="text-lg font-semibold">3. AI-generated content</h2>
            <p>
              SignalStory uses large language models to draft content. AI output
              can be inaccurate, incomplete, out of date, or similar to content
              generated for others, and we make{" "}
              <strong>
                no warranty of accuracy, fitness for a particular purpose, or
                originality
              </strong>{" "}
              of any generated output. You are solely responsible for reviewing,
              fact-checking, and editing output before use, and for anything you
              choose to publish — including content published automatically via
              integrations you enable (e.g. scheduled LinkedIn auto-publish). Do
              not rely on generated output as professional (legal, financial,
              medical) advice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Accounts &amp; acceptable use</h2>
            <p>
              Keep your credentials secure and your account information accurate.
              You agree not to:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                submit content you do not have the rights to use, or content that
                infringes intellectual-property, privacy, or publicity rights;
              </li>
              <li>
                use the service to generate deceptive, defamatory, harassing, or
                unlawful content, spam, or misinformation;
              </li>
              <li>
                probe, disrupt, or overload the service, bypass rate limits or
                plan quotas, or resell access without our written consent;
              </li>
              <li>
                misrepresent AI-generated content where disclosure is required by
                applicable law or platform rules.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Your content</h2>
            <p>
              You retain ownership of the content and context you submit and of the
              generated output. You grant us a limited license to process this
              content solely to provide the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Billing</h2>
            <p>
              Paid plans are billed monthly in advance via our payment processor.
              Plan limits apply per billing period. You can change or cancel your
              plan at any time; changes take effect according to your billing cycle.
              Fees are non-refundable except where required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Disclaimers</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; without warranties of any kind, express or implied,
              including merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the service will be
              uninterrupted or error-free.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for
              indirect, incidental, special, consequential, or punitive damages, or
              for lost profits, revenue, data, or goodwill — including damages
              arising from published AI-generated content. Our aggregate liability
              is limited to the amount you paid us in the twelve months before the
              claim.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Termination</h2>
            <p>
              You may delete your organization at any time from settings. We may
              suspend or terminate access for violations of these Terms, including
              the acceptable-use rules above, with notice where practicable. On
              termination, your data is deleted as described in our{" "}
              <Link className="underline" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. Changes &amp; contact</h2>
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
