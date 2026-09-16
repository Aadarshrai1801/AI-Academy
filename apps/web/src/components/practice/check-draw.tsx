"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Checkmark that draws itself in via `stroke-dashoffset` (§2.2).
 *
 * `pathLength="1"` normalises the glyph so one dash pair animates the whole
 * tick regardless of its geometry. Colour alone never carries the verdict —
 * this shares the option row with the text label "Correct answer".
 */
export function CheckDraw({ size = 16, className }: { size?: number; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <motion.path
        d="M4 12.5 L9.5 18 L20 6.5"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        initial={reduced ? { pathLength: 1 } : { pathLength: 0, strokeDashoffset: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ strokeDasharray: 1, filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }}
      />
    </svg>
  );
}
