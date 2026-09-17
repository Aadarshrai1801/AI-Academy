import type { Transition, Variants } from "framer-motion";

/**
 * Motion tokens — the single source of truth for every animation in the app
 * (§1.2). Components import these instead of hand-rolling durations, so
 * "fast, physical, consistent" stays true across pages.
 *
 * Rules encoded here:
 * - Position/scale changes use springs (never linear/ease-in-out).
 * - Micro-interactions 120–180ms, panels 250–400ms, celebrations ≤800ms.
 * - Everything is short enough to never gate a click.
 */

/** Spring presets (stiffness/damping tuned for UI, not physics demos). */
export const SPRING = {
  /** Default for taps, hovers, small position changes. */
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  /** Softer, for panels and larger travel. */
  soft: { type: "spring", stiffness: 180, damping: 26 },
  /** Overshoot for confirmations / toasts / pops. */
  pop: { type: "spring", stiffness: 420, damping: 26 },
  /** FLIP/layout animations: high stiffness so rows settle quickly. */
  layout: { type: "spring", stiffness: 350, damping: 32 },
} satisfies Record<string, Transition>;

/** Easings — cubic-bezier tuples mirror the CSS `--ease-*` tokens. */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1],
  springy: [0.34, 1.56, 0.64, 1],
} as const;

/**
 * Parent orchestrator for staggered lists (§2.1/§2.2). Pair with a fade+rise
 * child variant: 60–80ms between children reads as intentional, not slow.
 */
export function stagger(staggerChildren = 0.07, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

