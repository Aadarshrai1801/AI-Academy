import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/cn";

/**
 * Landing pricing band.
 *
 * Deliberately dark-on-white: a near-black full-bleed section that contrasts
 * with the light page, exactly as specced. Hardcoded hex values are
 * intentional here — the app token layer is light-theme, and this band is
 * specified pixel-for-pixel (#0a0a0a band, #1a1a1a side cards, #f5f5f5
 * featured card) rather than derived.
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
    tagline: "For indie hackers trying out AI for the first time.",
    price: "$0",
    per: "free forever",
    button: "Start for free",
    href: "/sign-up",
    includes: "Hobby plan includes",
    features: [
      { lead: "10 practice questions", rest: "per day" },
      { lead: "5 AI Tutor queries", rest: "per day" },
      { lead: "Cached videos", rest: "instant explainers" },
      { lead: "Public groups", rest: "join study cohorts" },
      { lead: "Daily leaderboard", rest: "public standing" },
      { lead: "15-min 1:1 calls", rest: "daily cap" },
    ],
  },
  {
    name: "Pro",
    tagline: "For teams that need more power and flexibility.",
    price: "$19",
    per: "/ Month",
    button: "Upgrade to Pro",
    href: "/pricing",
    includes: "Pro plan includes",
    features: [
      { lead: "Unlimited questions", rest: "continuous bank" },
      { lead: "100 AI queries", rest: "per day, KaTeX proofs" },
      { lead: "15–20 videos", rest: "synthesized per month" },
      { lead: "Cohorts up to 250", rest: "engineers" },
      { lead: "Unlimited calls", rest: "+ screen sharing" },
      { lead: "Streak freeze", rest: "banked monthly" },
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    tagline: "For organizations rolling out AI training at scale.",
    price: "Custom",
    per: "tailored quote",
    button: "Contact sales",
    href: "/sign-up",
    includes: "Enterprise plan includes",
    features: [
      { lead: "Everything in Pro", rest: "for every seat" },
      { lead: "SSO/SAML", rest: "sign-in for your org" },
      { lead: "Audit logs", rest: "compliance exports" },
      { lead: "Custom retention", rest: "data policies" },
      { lead: "Dedicated support", rest: "direct channel" },
      { lead: "Uptime SLA", rest: "& status reviews" },
    ],
  },
];

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const featured = tier.featured === true;
  return (
    <Reveal delay={index * 0.08} className="h-full">
      <div
        className={cn(
          "flex h-full flex-col rounded-[24px] p-8 sm:p-10",
          featured
            ? "bg-[#f5f5f5] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)] lg:-my-5 lg:py-[60px]"
            : "border border-white/10 bg-[#1a1a1a]",
        )}
      >
        <h3
          className={cn(
            "text-[28px] font-bold tracking-tight",
            featured ? "text-black" : "text-white",
          )}
        >
          {tier.name}
        </h3>
        <p className={cn("mt-2 text-sm leading-relaxed", featured ? "text-[#4a4a4a]" : "text-[#9a9a9a]")}>
          {tier.tagline}
        </p>

        <p className="mt-6 flex items-baseline gap-2">
          <span
            className={cn(
              "text-[56px] leading-none font-bold tracking-tight",
              featured ? "text-black" : "text-white",
            )}
          >
            {tier.price}
          </span>
          <span className={cn("text-sm", featured ? "text-[#6a6a6a]" : "text-[#9a9a9a]")}>
            {tier.per}
          </span>
        </p>

        <Link
          href={tier.href}
          className={cn(
            "mt-7 block w-full rounded-full py-3.5 text-center text-sm font-semibold transition-opacity hover:opacity-90",
            featured ? "bg-black text-white" : "bg-black text-white ring-1 ring-white/20",
          )}
        >
          {tier.button}
        </Link>

        <div className={cn("mt-7 border-t border-dotted", featured ? "border-black/20" : "border-white/20")} />

        <p
          className={cn(
            "mt-6 text-[11px] font-semibold uppercase tracking-[0.18em]",
            featured ? "text-[#6a6a6a]" : "text-[#9a9a9a]",
          )}
        >
          {tier.includes}
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {tier.features.map((feature) => (
            <li key={feature.lead} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                  featured ? "bg-black" : "bg-white/15",
                )}
                aria-hidden="true"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
              <span className={featured ? "text-[#2a2a2a]" : "text-[#c9c9c9]"}>
                <strong className={cn("font-semibold", featured ? "text-black" : "text-white")}>
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
    <section id="pricing" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-16 bg-[#0a0a0a]">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
            Pricing
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Simple pricing that scales with you
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#9a9a9a]">
            Start free, upgrade when the daily cap slows you down. Cancel anytime —
            Pro covers the compute behind AI reasoning and video synthesis.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((tier, index) => (
            <TierCard key={tier.name} tier={tier} index={index} />
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center font-mono text-[11px] text-[#6a6a6a]">
            Pro bills $19/mo or $180/yr through Stripe · Enterprise is a tailored quote
          </p>
        </Reveal>
      </div>
    </section>
  );
}
