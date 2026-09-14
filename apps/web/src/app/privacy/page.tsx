import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AI Academy",
  description: "How AI Academy collects, uses, and protects your personal data.",
};

const UPDATED = "[EFFECTIVE DATE]";

/**
 * User-facing privacy policy. Keep the substance in sync with `PRIVACY.md`
 * (the canonical, longer version reviewed by counsel and the fill-in checklist
 * in `docs/COMPLIANCE.md`).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <div className="font-mono text-xs text-[var(--tungsten)]">{"//"} LEGAL</div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink-chalk)]">Privacy Policy</h1>
      <p className="mt-1 font-mono text-xs text-[var(--ink-lead)]">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink-lead)]">
        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">1. Who we are</h2>
          <p className="mt-2">
            [LEGAL ENTITY NAME], [REGISTERED ADDRESS], operates AI Academy (the
            &quot;Service&quot;) and is the data controller for the personal data described here.
            Privacy contact: [PRIVACY CONTACT EMAIL].
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">2. What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account data: name, email address, username, avatar, authentication metadata (via Clerk).</li>
            <li>Learning data: questions served, answers, correctness, time taken, points, streaks, analytics.</li>
            <li>Social data: group memberships, chat messages, reactions, read receipts, abuse reports.</li>
            <li>AI features: questions you ask the tutor, generated answers, explainer video jobs.</li>
            <li>Calls: participants, timestamps, duration, screen-share usage, reports. Calls are not recorded by default.</li>
            <li>Billing: plan, subscription status, and Stripe identifiers. We never store full card numbers.</li>
            <li>Usage data: IP address, user agent, request identifiers, error diagnostics.</li>
          </ul>
          <p className="mt-2">
            We do not sell your data and we do not run advertising or cross-site tracking.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">3. Why we use it</h2>
          <p className="mt-2">
            To provide the Service (contract), to process payments (contract and legal
            obligation), to protect the Service against abuse (legitimate interests), and to
            respond to lawful requests (legal obligation). Where we rely on consent, you can
            withdraw it at any time.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">4. AI features</h2>
          <p className="mt-2">
            Your question text is sent to a third-party language model provider to generate an
            answer, and is stored in your private history. Answers are generated automatically
            and may be incomplete or wrong — they are not professional advice.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">5. Sharing</h2>
          <p className="mt-2">
            We share data with hosting and infrastructure subprocessors (authentication,
            database, caching, file storage, realtime, error monitoring, AI providers) under
            data-processing agreements. Your username, points, and rank are visible to other
            users on leaderboards, and group members see your messages and call participation.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">6. Retention</h2>
          <p className="mt-2">
            Data is kept while your account exists. Free-tier chat messages are hidden from view
            after 30 days; rate-limit counters expire in 60 seconds; leaderboards in 3 days.
            Deleting your account removes or anonymizes your data, including rendered videos.
            Billing records are retained by Stripe as required by tax law.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">7. Your rights</h2>
          <p className="mt-2">
            You can download everything we store about you from the dashboard (&quot;Data &amp;
            privacy&quot;), and you can permanently erase your account and data from the same
            place, or by emailing us. Depending on where you live you may also have rights to
            rectification, restriction, objection, portability, and to lodge a complaint with
            your supervisory authority. We respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">8. Children</h2>
          <p className="mt-2">
            The Service is for people aged 13 or older. We do not knowingly collect data from
            children under 13; if you believe a child under 13 has an account, contact
            [PRIVACY CONTACT EMAIL] and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">9. Cookies</h2>
          <p className="mt-2">
            We use strictly necessary cookies and browser storage for sign-in and security.
            Stripe may set cookies on its checkout pages. Blocking cookies prevents sign-in and
            billing from working.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--ink-chalk)]">10. Contact</h2>
          <p className="mt-2">
            Questions or requests: [PRIVACY CONTACT EMAIL]. See also our{" "}
            <Link href="/terms" className="text-[var(--tungsten)] hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
