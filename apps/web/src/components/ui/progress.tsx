"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * `<ProgressBar>` / `<ProgressRing>` — animated fill primitives (§3).
 *
 * The fill uses the single indigo accent, dimming as the value depletes.
 * Urgency is communicated through brightness and a faster pulse near empty,
 * alongside the semantic status colors.
 *
 * The bar animates `scaleX` from the left edge rather than `width`, so the
 * work stays on the compositor and never triggers layout (§5).
 */

export type ProgressTone = "brand" | "iris" | "success" | "warning" | "error" | "cyan";

/**
 * Semantic tone → fill mapping. Callers hand in a tone from `accuracyTone`
 * or `quotaTone`, so the bar/ring shifts brand → amber → rose as a metric
 * (or a remaining quota) degrades.
 */
const TONE_FILL: Record<ProgressTone, string> = {
  brand: "bg-brand",
  iris: "bg-brand-bright",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  cyan: "bg-state-info",
};

const TONE_STROKE: Record<ProgressTone, string> = {
  brand: "var(--brand)",
  iris: "var(--brand-bright)",
  success: "var(--state-positive)",
  warning: "var(--state-warning)",
  error: "var(--state-negative)",
  cyan: "var(--state-info)",
};

/**
 * Accuracy band (§2.7): rose under 50%, amber up to 75%, green above.
 */
export function accuracyTone(ratio: number | null | undefined): ProgressTone {
  if (ratio === null || ratio === undefined) return "brand";
  if (ratio < 0.5) return "error";
  if (ratio <= 0.75) return "warning";
  return "success";
}

/**
 * Quota band (§2.8): amber as the allowance runs low, rose when nearly out.
 */
export function quotaTone(remaining: number, limit: number): ProgressTone {
  if (limit <= 0) return "brand";
  const ratio = remaining / limit;
  if (ratio <= 0.15) return "error";
  if (ratio <= 0.45) return "warning";
  return "brand";
}

/** Fill dims slightly as the value depletes — an extra non-color cue. */
function fillOpacity(ratio: number): number {
  // Full brightness at 100%, dims to 0.55 at 0%
  return 0.55 + ratio * 0.45;
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone | "auto";
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  size = "sm",
  className,
  label,
}: ProgressBarProps) {
  const reduced = useReducedMotion();
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(Math.max(value / safeMax, 0), 1);
  const opacity = fillOpacity(ratio);
  const isLow = ratio < 0.2;
  const resolvedTone: ProgressTone = tone === "auto" ? "brand" : tone;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-surface-4",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
    >
      <motion.div
        className={cn(
          "absolute inset-y-0 left-0 w-full origin-left rounded-full",
          TONE_FILL[resolvedTone],
          isLow && "animate-breathe",
        )}
        style={{ opacity }}
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={{ type: "spring", stiffness: 180, damping: 26 }}
      />
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone | "auto";
  className?: string;
  children?: ReactNode;
  label?: string;
}

/** Donut gauge — quota, streak adherence, session completion. */
export function ProgressRing({
  value,
  max = 100,
  size = 44,
  strokeWidth = 4,
  tone = "brand",
  className,
  children,
  label,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(Math.max(value / safeMax, 0), 1);
  const opacity = fillOpacity(ratio);
  const isLow = ratio < 0.2;
  const resolvedTone: ProgressTone = tone === "auto" ? "brand" : tone;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
      className={cn(
        "relative inline-grid place-items-center",
        isLow && "animate-breathe",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-4)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[resolvedTone]}
          strokeOpacity={opacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduced ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
        />
      </svg>
      {children && (
        <span className="absolute inset-0 grid place-items-center font-mono text-[10px] font-semibold tabular-nums text-fg">
          {children}
        </span>
      )}
    </div>
  );
}
