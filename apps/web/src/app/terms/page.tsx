import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — AI Academy",
  description: "The rules for using AI Academy.",
};

const UPDATED = "[EFFECTIVE DATE]";

/**
 * User-facing terms. Keep the substance in sync with `TERMS.md` (the canonical,
 * longer version reviewed by counsel and the fill-in checklist in
 * `docs/COMPLIANCE.md`).
 */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <div className="font-mono text-xs text-[var(--tungsten)]">{"//"} LEGAL</div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink-chalk)]">Terms of Service</h1>
      <p className="mt-1 font-mono text-xs text-[var(--ink-lead)]">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-lead)]">
        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">1. Agreement and eligibility</h2>
          <p className="mt-2">
            By using AI Academy you agree to these Terms and to our{" "}
            <Link href="/privacy" className="text-[var(--tungsten)] hover:underline">
              Privacy Policy
            </Link>
            . You must be at least 13 years old (with a parent or guardian if you are under the
            age of majority where you live). Contact [LEGAL CONTACT EMAIL] with questions.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">2. Accounts</h2>
          <p className="mt-2">
            Provide accurate information, keep your credentials secure, and tell us promptly
            about unauthorized access. You are responsible for activity under your account.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">3. Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Do not cheat, automate answers, farm points, or manipulate leaderboards.</li>
            <li>Do not scrape, bulk-extract, circumvent quotas, or bypass paywalls.</li>
            <li>Do not harass others, spam, or share illegal or harmful content.</li>
            <li>Do not attack the Service; security research follows our security policy.</li>
            <li>Do not present AI output as professional advice.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">4. Your content</h2>
          <p className="mt-2">
            You own what you submit and grant us a license to process it solely to operate the
            Service (for example, to answer a question or show a message to your group). We may
            moderate content that violates these Terms.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">5. AI features</h2>
          <p className="mt-2">
            AI answers and videos are generated automatically, may be wrong, and are not
            professional advice. Verify information independently before relying on it.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">6. Calls</h2>
          <p className="mt-2">
            Calls are not recorded by default. You must obtain any consent required by law
            before recording or sharing a call, and free-tier calls are subject to server-side
            duration caps.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">7. Subscriptions and billing</h2>
          <p className="mt-2">
            Paid plans are billed through Stripe and renew automatically until cancelled. Cancel
            any time in the billing portal; access continues to the end of the paid period.
            Except where required by law or expressly stated, payments are non-refundable. Plan
            limits may change with notice; free features may change.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">8. Points and leaderboards</h2>
          <p className="mt-2">
            Points, streaks, ranks, and rewards have no monetary value and may be corrected or
            reset to fix errors or abuse.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">9. Intellectual property</h2>
          <p className="mt-2">
            The Service and its content are owned by us or our licensors. You get a limited,
            revocable license to use it for personal, non-commercial learning. All rights not
            granted are reserved.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">10. Availability, disclaimers, liability</h2>
          <p className="mt-2">
            The Service is provided &quot;as is&quot; without warranties, and may be modified,
            suspended, or discontinued. To the maximum extent permitted by law our aggregate
            liability is limited to the greater of what you paid us in the last 12 months or
            [LIABILITY CAP]. Nothing excludes liability that cannot be excluded by law.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">11. Termination</h2>
          <p className="mt-2">
            You may delete your account at any time (Dashboard → Data &amp; privacy). We may
            suspend or terminate access if you breach these Terms or to protect the Service or
            other users.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">12. Governing law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of [GOVERNING JURISDICTION], with disputes
            subject to the courts of [VENUE], except where mandatory consumer law gives you the
            right to sue where you live.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">13. Contact</h2>
          <p className="mt-2">Questions about these Terms: [LEGAL CONTACT EMAIL].</p>
        </section>
      </div>
    </main>
  );
}
