"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";

/**
 * Scroll-triggered reveal (§2.1).
 *
 * `useInView` wraps IntersectionObserver, so cards animate as they enter the
 * viewport with a staggered delay instead of all firing on load. `once: true`
 * means the page never re-animates on scroll-back, which is the difference
 * between "alive" and "twitchy".
 *
 * Reduced motion keeps the fade and drops the travel.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Seconds. Grids pass `index * 0.07` for a 70ms stagger. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: reduced ? 0.2 : 0.45, delay: reduced ? 0 : delay, ease: EASE.outExpo }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Word-by-word headline reveal (§2.1): fade + 8px rise, ~40ms per line.
 * Splitting on words (not characters) keeps it readable and avoids reflow
 * thrash — each word is an inline-block that only ever animates transform and
 * opacity.
 */
export function StaggeredHeadline({
  lines,
  className,
}: {
  lines: Array<{ text: ReactNode; accent?: boolean }>;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <h1 className={className}>
      {lines.map((line, lineIndex) => (
        <motion.span
          key={lineIndex}
          className="block"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0.2 : 0.5,
            delay: reduced ? 0 : lineIndex * 0.04 + 0.05,
            ease: EASE.outExpo,
          }}
        >
          {line.accent ? (
            <span className="bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {line.text}
            </span>
          ) : (
            line.text
          )}
        </motion.span>
      ))}
    </h1>
  );
}
