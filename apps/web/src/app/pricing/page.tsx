import { CheckoutButtons } from "@/components/billing";

const rows: Array<[string, string, string]> = [
  ["Daily practice questions", "10 questions / day", "Unlimited (continuous bank)"],
  ["Hard & Extreme problem sets", "2 teaser previews / day", "Full access to all ML interview banks"],
  ["AI Tutor text explanations", "5 queries / day", "100 queries / day with KaTeX proofs"],
  ["AI Video explainer synthesis", "Cached videos only", "15-20 novel synthesized videos / month"],
  ["Study cohorts & groups", "Join public groups", "Create cohorts up to 250 engineers"],
  ["Study group video calls", "15-min cap (1:1)", "Unlimited call duration + screen sharing"],
  ["Leaderboard telemetry", "Daily standing only", "All-time history, cohort filters, percentile analytics"],
  ["Streak freeze protection", "None", "1 auto-replenishing freeze banked per month"],
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="border-b border-[var(--seam)] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span>MEMBERSHIP & COMPUTE //</span>
          <span className="text-[var(--tungsten)]">ENTITLEMENT MATRIX</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Free vs. Pro
        </h1>
        <p className="mt-1 text-xs text-[var(--ink-lead)] max-w-2xl">
          Core practice and daily ranking are free for everyone. Pro membership covers the compute cost of running LLM reasoning pipelines, custom video rendering, and LiveKit WebRTC infrastructure.
        </p>
      </div>

      {/* Two Tier Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <div className="flex flex-col justify-between rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div>
            <div className="font-mono text-xs text-[var(--ink-lead)] uppercase">Baseline Access</div>
            <div className="mt-2 text-xl font-bold text-[var(--ink-chalk)]">Community Member</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[var(--ink-chalk)]">$0</div>
            <p className="mt-3 text-xs text-[var(--ink-lead)] leading-relaxed">
              Ideal for daily habit-building, basic self-assessment, and keeping an unbroken learning streak.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--seam)] pt-4 font-mono text-xs text-[var(--ink-lead)]">
            Includes: 10 daily questions, public leaderboard standing, and instant cached AI answers.
          </div>
        </div>

        {/* Pro Plan */}
        <div className="relative flex flex-col justify-between rounded-lg border border-[var(--tungsten)] bg-[var(--tungsten)]/5 p-6 shadow-[0_0_24px_rgba(229,133,55,0.08)]">
          <div className="absolute -top-2.5 right-4 rounded bg-[var(--tungsten)] px-2 py-0.5 font-mono text-[10px] font-bold text-black uppercase">
            Recommended for ML Engineers
          </div>
          <div>
            <div className="font-mono text-xs text-[var(--tungsten)] uppercase">Full Compute Tier</div>
            <div className="mt-2 text-xl font-bold text-[var(--ink-chalk)]">Pro Engineer</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[var(--tungsten)]">$19 <span className="text-xs text-[var(--ink-lead)] font-normal">/ month</span></div>
            <p className="mt-3 text-xs text-[var(--ink-lead)] leading-relaxed">
              Unrestricted problem sets, on-demand AI video synthesis, group study call hosting, and streak freeze protections.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--seam)] pt-4 font-mono text-xs text-[var(--tungsten)]">
            Cancel anytime via self-serve Stripe Customer Portal.
          </div>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--seam)] bg-[var(--chassis)]">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--seam)] bg-[var(--panel)] font-mono text-[11px] text-[var(--ink-lead)]">
              <th className="p-3.5">CAPABILITY // SPECIFICATION</th>
              <th className="p-3.5">FREE</th>
              <th className="p-3.5 text-[var(--tungsten)]">PRO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--seam)] font-mono">
            {rows.map(([f, free, pro]) => (
              <tr key={f} className="transition-colors hover:bg-[var(--panel)]">
                <td className="p-3.5 font-sans font-medium text-[var(--ink-chalk)]">{f}</td>
                <td className="p-3.5 text-[var(--ink-lead)]">{free}</td>
                <td className="p-3.5 font-semibold text-[var(--ink-chalk)]">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CheckoutButtons />

      <div className="mt-8 border-t border-[var(--seam)] pt-4 text-center font-mono text-[11px] text-[var(--ink-dim)]">
        Transactions processed via 256-bit encrypted Stripe Checkout. No recurring lock-in.
      </div>
    </main>
  );
}
