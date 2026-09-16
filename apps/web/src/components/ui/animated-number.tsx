"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * `<AnimatedNumber>` — count-up stat (§3, §2.7).
 *
 * Writes straight to the DOM node's `textContent` from Framer Motion's
 * animation loop driven by a `MotionValue`: no React re-render per frame, so a
 * dashboard full of these stays at 60fps on low-end hardware (§5).
 *
 * SSR renders the final value (correct for no-JS and crawlers); the client
 * then counts up from zero on mount. A later `value` change animates from the
 * current position instead of restarting, which keeps refreshes calm.
 * Under `prefers-reduced-motion` the final value is simply left in place.
 */
export interface AnimatedNumberProps {
  value: number;
  /** Seconds. Dashboard tiles use ~0.6s; small inline stats ~0.3s. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Thousands separators (default true). */
  separator?: boolean;
  className?: string;
}

function formatValue(
  value: number,
  decimals: number,
  separator: boolean,
  prefix: string,
  suffix: string,
): string {
  const body = separator
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toFixed(decimals);
  return `${prefix}${body}${suffix}`;
}

export function AnimatedNumber({
  value,
  duration = 0.6,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = true,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const count = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (v: number) => formatValue(v, decimals, separator, prefix, suffix);

    if (reduced) {
      el.textContent = fmt(value);
      return;
    }

    const controls = animate(count, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
      onComplete: () => {
        el.textContent = fmt(value);
      },
    });
    return () => controls.stop();
  }, [value, duration, decimals, separator, prefix, suffix, reduced, count]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {formatValue(value, decimals, separator, prefix, suffix)}
    </span>
  );
}
