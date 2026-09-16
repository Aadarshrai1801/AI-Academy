"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * `<ProgressBar>` / `<ProgressRing>` — animated fill primitives (§3).
 *
 * The bar animates `scaleX` from the left edge rather than `width`, so the
 * work stays on the compositor and never triggers layout (§5). Track and fill
 * live in separate layers so the fill can be transformed freely.
 */

export type ProgressTone = "brand" | "iris" | "success" | "warning" | "error" | "cyan";

const TONE_BG: Record<ProgressTone, string> = {
  brand: "bg-brand",
  iris: "bg-iris",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  cyan: "bg-cyan",
};

/**
 * Accuracy band used across Practice/Dashboard (§2.7):
 * rose < 50%, amber 50–75%, emerald > 75%.
 */
export function accuracyTone(ratio: number | null | undefined): ProgressTone {
  if (ratio === null || ratio === undefined) return "brand";
  if (ratio < 0.5) return "error";
  if (ratio <= 0.75) return "warning";
  return "success";
}

/**
 * Quota band for the shell indicator (§2.8): the ring depletes and shifts to
 * amber, then rose, as the daily allowance runs out.
 */
export function quotaTone(remaining: number, limit: number): ProgressTone {
  if (limit <= 0) return "brand";
  const ratio = remaining / limit;
  if (ratio <= 0.15) return "error";
  if (ratio <= 0.45) return "warning";
  return "brand";
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone | "auto";
  /** `auto` maps the value/max ratio through `accuracyTone`. */
  size?: "sm" | "md";
  className?: string;
  /** Accessible name; the bar is `role="progressbar"` with real bounds. */
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
  const resolvedTone = tone === "auto" ? accuracyTone(ratio) : tone;

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
        className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", TONE_BG[resolvedTone])}
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
  const resolvedTone = tone === "auto" ? accuracyTone(ratio) : tone;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const STROKE: Record<ProgressTone, string> = {
    brand: "var(--brand)",
    iris: "var(--iris)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--error)",
    cyan: "var(--cyan)",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
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
          stroke={STROKE[resolvedTone]}
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
