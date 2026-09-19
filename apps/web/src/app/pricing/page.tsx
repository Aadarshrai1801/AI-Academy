import { CheckoutButtons } from "@/components/billing";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

const rows: Array<[string, string, string]> = [
  ["Daily practice questions", "10 questions / day", "Unlimited (continuous bank)"],
  ["Hard & Extreme problem sets", "2 teaser previews / day", "Full access to all ML interview banks"],
  ["AI Tutor text explanations", "5 queries / day", "100 queries / day with KaTeX proofs"],
  ["AI Video explainer synthesis", "Cached videos only", "15-20 novel synthesized videos / month"],
  ["Study cohorts & groups", "Join public groups", "Create cohorts up to 250 engineers"],
  ["Personalized direct messages", "Standard 1:1 messaging", "Unlimited DMs + interactive practice challenges & prompts"],
  ["Leaderboard telemetry", "Daily standing only", "All-time history, cohort filters, percentile analytics"],
  ["Streak freeze protection", "None", "1 auto-replenishing freeze banked per month"],
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="border-b border-[var(--line)] pb-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
          <span>MEMBERSHIP & COMPUTE</span>
          <span className="text-[var(--line-strong)]">{"//"}</span>
          <span className="text-[var(--fg-muted)]">ENTITLEMENT MATRIX</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">
          Free vs. Pro
        </h1>
        <p className="mt-1.5 text-xs text-[var(--fg-muted)] max-w-2xl leading-relaxed">
          Core practice and daily ranking are free for everyone. Pro membership covers the compute cost of running LLM reasoning pipelines, custom video rendering, and real-time study messaging infrastructure.
        </p>
      </div>

      {/* Two Tier Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-6">
          <div>
            <div className="font-mono text-[10px] text-[var(--fg-dim)] uppercase tracking-wider">Baseline Access</div>
            <div className="mt-2 text-xl font-bold text-[var(--fg)]">Community Member</div>
            <div className="mt-1 font-mono text-3xl font-bold text-[var(--fg)]">$0</div>
            <p className="mt-3 text-xs text-[var(--fg-muted)] leading-relaxed">
              Ideal for daily habit-building, basic self-assessment, and keeping an unbroken learning streak.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4 font-mono text-xs text-[var(--fg-dim)]">
            Includes: 10 daily questions, public leaderboard standing, and instant cached AI answers.
          </div>
        </div>

        {/* Pro Plan */}
        <CardSpotlight className="border-brand/30 bg-surface-2 shadow-lift">
          <div className="relative flex flex-col justify-between h-full p-6">
            <div className="absolute top-4 right-4 rounded-md border border-transparent bg-brand px-2.5 py-0.5 font-mono text-[10px] font-bold text-on-brand uppercase tracking-wider shadow-sm">
              Recommended for ML Engineers
            </div>
            <div>
              <div className="font-mono text-[10px] text-fg-dim uppercase tracking-wider">Full Compute Tier</div>
              <div className="mt-2 text-xl font-bold text-fg">Pro Engineer</div>
              <div className="mt-1 font-mono text-3xl font-bold text-fg">
                $19 <span className="text-xs text-[var(--fg-muted)] font-normal font-sans">/ month</span>
              </div>
              <p className="mt-3 text-xs text-[var(--fg-muted)] leading-relaxed">
                Unrestricted problem sets, on-demand AI video synthesis, personalized direct messages with challenge sharing, and streak freeze protections.
              </p>
            </div>
            <div className="mt-6 border-t border-line pt-4 font-mono text-xs text-[var(--fg-dim)]">
              Cancel anytime via self-serve Stripe Customer Portal.
            </div>
          </div>
        </CardSpotlight>
      </div>

      {/* Comparison Matrix Table */}
      <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
              <th className="p-3.5">CAPABILITY // SPECIFICATION</th>
              <th className="p-3.5">FREE</th>
              <th className="p-3.5 text-fg font-semibold">PRO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] font-mono">
            {rows.map(([f, free, pro]) => (
              <tr key={f} className="transition-colors hover:bg-surface-2">
                <td className="p-3.5 font-sans font-medium text-[var(--fg)]">{f}</td>
                <td className="p-3.5 text-[var(--fg-muted)]">{free}</td>
                <td className="p-3.5 font-semibold text-fg">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CheckoutButtons />

      <div className="mt-8 border-t border-[var(--line)] pt-4 text-center font-mono text-[11px] text-[var(--fg-dim)]">
        Transactions processed via 256-bit encrypted Stripe Checkout. No recurring lock-in.
      </div>
    </main>
  );
}
