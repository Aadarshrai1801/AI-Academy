"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ProgressTone, accuracyTone } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Accuracy-by-topic bars (§2.7).
 *
 * Replaces the previous flat progress rows with a bar per topic that fills
 * from zero on mount, banded by accuracy (rose < 50%, amber 50–75%, emerald
 * > 75%) and matched to the same `accuracyTone` the Practice and Dashboard
 * KPIs use — one definition of "good" across the app.
 *
 * The percentage and attempt count are always visible in text; the hover/focus
 * tooltip adds the correct/total split, so nothing is hover-only (§4).
 */
export interface TopicBarRow {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
}

export function TopicBars({ rows }: { rows: TopicBarRow[] }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const maxAttempts = Math.max(...rows.map((r) => r.attempts), 1);

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row, index) => {
        const pct = Math.round((row.accuracy ?? 0) * 100);
        const tone: ProgressTone = accuracyTone(row.accuracy);
        const width = row.accuracy ?? 0;
        const isActive = active === row.topic;

        const barClass = {
          brand: "bg-brand",
          iris: "bg-iris",
          cyan: "bg-cyan",
          success: "bg-success",
          warning: "bg-warning",
          error: "bg-error",
        }[tone];

        const textClass = {
          brand: "text-brand",
          iris: "text-iris",
          cyan: "text-cyan",
          success: "text-success",
          warning: "text-warning",
          error: "text-error",
        }[tone];

        return (
          <li key={row.topic}>
            <button
              type="button"
              onMouseEnter={() => setActive(row.topic)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(row.topic)}
              onBlur={() => setActive(null)}
              aria-label={`${row.topic}: ${pct}% accuracy over ${row.attempts} attempt${
                row.attempts === 1 ? "" : "s"
              }, ${row.correct} correct`}
              className="group relative block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {/* Tooltip with the detail the bar cannot show. */}
              {isActive && (
                <motion.span
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                  className="absolute -top-1 right-0 z-10 -translate-y-full rounded-lg border border-line bg-surface-4 px-2.5 py-1.5 font-mono text-[10px] whitespace-nowrap text-fg shadow-pop"
                >
                  {row.correct}/{row.attempts} correct · {Math.round((row.attempts / maxAttempts) * 100)}% of
                  your volume
                </motion.span>
              )}

              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs font-medium text-fg">{row.topic}</span>
                <span className="flex shrink-0 items-baseline gap-2 font-mono text-[11px] tabular-nums">
                  <span className="text-fg-dim">
                    {row.attempts} att.
                  </span>
                  <span className={cn("font-semibold", textClass)}>{pct}%</span>
                </span>
              </div>

              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-4">
                <motion.div
                  className={cn("h-full origin-left rounded-full", barClass)}
                  style={{ width: "100%" }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: width }}
                  transition={{
                    type: "spring",
                    stiffness: 160,
                    damping: 24,
                    delay: reduced ? 0 : index * 0.05,
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
