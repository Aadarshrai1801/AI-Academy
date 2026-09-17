import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/cn";

/**
 * Landing pricing band.
 *
 * A clean light-neutral full-bleed section that contrasts with the page
 * canvas through the surface ramp and hairlines rather than a dark flood.
 * The featured tier is marked with the single indigo accent.
 *
 * Prices are the real billing tiers: Free $0 and Pro $19/mo map to the Stripe
 * checkout on /pricing. Enterprise is display-only (contact path) because no
 * Stripe product exists for it.
 */
interface TierFeature {
  lead: string;
  rest: string;
}

interface Tier {
  name: string;
  tagline: string;
  price: string;
  per: string;
  button: string;
  href: string;
  includes: string;
  features: TierFeature[];
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Hobby",
    tagline: "For getting started — free forever.",
    price: "$0",
    per: "free forever",
    button: "Start for free",
    href: "/sign-up",
    includes: "Hobby plan includes",
    features: [
      { lead: "10 practice questions", rest: "every day" },
      { lead: "5 AI Tutor questions", rest: "every day" },
      { lead: "Video explainers", rest: "from the library" },
      { lead: "Study groups", rest: "learn with peers" },
      { lead: "Daily leaderboard", rest: "compete every day" },
      { lead: "1:1 video calls", rest: "15 minutes a day" },
    ],
  },
  {
    name: "Pro",
    tagline: "For engineers who practice every day.",
    price: "$19",
    per: "/ Month",
    button: "Upgrade to Pro",
    href: "/pricing",
    includes: "Pro plan includes",
    features: [
      { lead: "Unlimited questions", rest: "never run out" },
      { lead: "100 AI Tutor questions", rest: "a day, with proofs" },
      { lead: "15–20 custom videos", rest: "every month" },
      { lead: "Large cohorts", rest: "up to 250 engineers" },
      { lead: "Unlimited video calls", rest: "with screen sharing" },
      { lead: "Streak freeze", rest: "one banked monthly" },
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    tagline: "For teams learning together.",
    price: "Custom",
    per: "tailored quote",
    button: "Contact sales",
    href: "/sign-up",
    includes: "Enterprise plan includes",
    features: [
      { lead: "Everything in Pro", rest: "for every seat" },
      { lead: "SSO sign-in", rest: "for your whole org" },
      { lead: "Audit logs", rest: "compliance exports" },
      { lead: "Custom retention", rest: "data policies" },
      { lead: "Dedicated support", rest: "direct channel" },
      { lead: "Uptime SLA", rest: "with status reviews" },
    ],
  },
];

import { BackgroundBeams } from "@/components/ui/aceternity/background-beams";

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const featured = tier.featured === true;
  return (
    <Reveal delay={index * 0.08} className="h-full">
      <div
        className={cn(
          "relative flex h-full flex-col rounded-[24px] p-8 sm:p-10 transition-all duration-300",
          featured
            ? "border-2 border-brand bg-surface-2 shadow-lift lg:-my-5 lg:py-[56px]"
            : "border border-line bg-surface-1 hover:border-line-strong",
        )}
      >
        {featured && (
          <div className="absolute top-4 right-6 rounded-full border border-line bg-surface-3 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg shadow-xs">
            Most Popular
          </div>
        )}

        <h3 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          {tier.name}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--fg-muted)] sm:text-sm">
          {tier.tagline}
        </p>

        <p className="mt-6 flex items-baseline gap-2">
          <span className="text-5xl leading-none font-bold tracking-tight text-fg sm:text-6xl">
            {tier.price}
          </span>
          <span className="text-xs font-mono text-[var(--fg-muted)]">
            {tier.per}
          </span>
        </p>

        <Link
          href={tier.href}
          className={cn(
            "mt-7 block w-full rounded-xl py-3 text-center font-mono text-xs font-semibold transition-all",
            featured
              ? "bg-brand text-on-brand shadow-sm hover:bg-brand-strong active:scale-[0.98]"
              : "border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3 shadow-xs",
          )}
        >
          {tier.button}
        </Link>

        <div className="mt-7 border-t border-line border-dashed" />

        <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-dim)]">
          {tier.includes}
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {tier.features.map((feature) => (
            <li key={feature.lead} className="flex items-start gap-3 text-xs sm:text-sm">
              <span
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line bg-surface-3"
                aria-hidden="true"
              >
                <Check className="h-2.5 w-2.5 text-fg" strokeWidth={3} />
              </span>
              <span className="text-[var(--fg-muted)]">
                <strong className="font-semibold text-fg">
                  {feature.lead}
                </strong>{" "}
                {feature.rest}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export function PricingTiers() {
  return (
    <section id="pricing" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-16 bg-surface-0 overflow-hidden border-y border-line py-20 sm:py-24">
      <BackgroundBeams className="opacity-10" />
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
            Pricing
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-fg sm:text-4xl">
            Simple pricing for ML engineers
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-muted)] sm:text-sm">
            Start free. Upgrade when you want unlimited practice and AI tutoring —
            cancel anytime.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((tier, index) => (
            <TierCard key={tier.name} tier={tier} index={index} />
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center font-mono text-[11px] text-[var(--fg-dim)]">
            Pro bills $19/mo or $180/yr through Stripe · Enterprise is a tailored quote
          </p>
        </Reveal>
      </div>
    </section>
  );
}
