"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Generic animated bar list — a neutral sibling of `TopicBars` for data with
 * no accuracy semantics (admin DAU, per-day volumes). Bars fill from zero on
 * mount and the value is always rendered as text, so nothing is hover-only.
 */
export function BarList({
  rows,
}: {
  rows: Array<{ label: string; value: number; hint?: string }>;
}) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row, index) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-fg-muted">{row.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-fg-dim">
              {row.hint ?? row.value}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full border border-line/40 bg-surface-3">
            <motion.div
              className="h-full origin-left rounded-full bg-brand/80"
              style={{ width: "100%" }}
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: row.value / max }}
              transition={{
                type: "spring",
                stiffness: 160,
                damping: 24,
                delay: reduced ? 0 : index * 0.04,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
