"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Timer } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Speed-bonus timer (§2.2).
 *
 * The grader awards `base × 1.5` when an answer lands within 30s
 * (`FAST_THRESHOLD_MS` in `attempts.service.ts`), but nothing in the UI ever
 * showed that window — so the colour ramp had nothing real to hang off.
 *
 * This renders the elapsed clock plus a depleting bar for the bonus window,
 * which is what gives the brief's "amber under 10s, rose under 5s, pulse in
 * the final 5s" an honest meaning: those are *seconds of bonus remaining*, not
 * an invented hard time limit. Running out never blocks a submission — the
 * question stays answerable, it simply stops paying the multiplier.
 */
export const SPEED_BONUS_SECONDS = 30;

export interface SpeedTimerProps {
  elapsedSeconds: number;
  /** Hidden clock must not hide the fact that a bonus is running out. */
  clockVisible: boolean;
  onToggleClock: () => void;
  /** Once the verdict is in, the clock stops mattering. */
  frozen?: boolean;
}

export function SpeedTimer({
  elapsedSeconds,
  clockVisible,
  onToggleClock,
  frozen = false,
}: SpeedTimerProps) {
  const reduced = useReducedMotion();

  const remaining = Math.max(0, SPEED_BONUS_SECONDS - elapsedSeconds);
  const ratio = remaining / SPEED_BONUS_SECONDS;
  const expired = remaining <= 0;

  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");

  // Speed-bonus urgency: green → amber → rose as the window depletes.
  const tone = expired
    ? "muted"
    : remaining <= 5
      ? "critical"
      : remaining <= 10
        ? "warning"
        : "bright";

  const barClass = {
    bright: "bg-success",
    warning: "bg-warning",
    critical: "bg-error shadow-xs",
    muted: "bg-surface-4",
  }[tone];

  const textClass = {
    bright: "text-state-positive-ink",
    warning: "text-state-warning-ink",
    critical: "text-state-negative-ink font-bold",
    muted: "text-fg-dim",
  }[tone];

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-surface-3 px-2.5 py-1.5 transition-all",
        tone === "critical"
          ? "border-error/40 shadow-glow"
          : tone === "warning"
            ? "border-warning/40"
            : "border-line",
        tone === "critical" && !reduced && "animate-breathe",
      )}
      title={
        expired
          ? "Speed bonus expired — answers still count, at base points"
          : `${remaining}s left to earn the 1.5× speed bonus`
      }
    >
      <button
        type="button"
        onClick={onToggleClock}
        aria-pressed={clockVisible}
        aria-label={clockVisible ? "Hide elapsed time" : "Show elapsed time"}
        className="flex items-center gap-1.5 rounded font-mono text-xs tabular-nums transition-colors"
      >
        <Timer className={cn("h-3.5 w-3.5", textClass)} aria-hidden="true" />
        <span className={cn("font-medium", textClass)}>
          {clockVisible ? `${minutes}:${seconds}` : "••:••"}
        </span>
      </button>

      {!frozen && (
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-4">
            <motion.div
              className={cn("h-full origin-left rounded-full", barClass)}
              style={{ width: "100%" }}
              initial={false}
              animate={{ scaleX: ratio }}
              transition={{ duration: reduced ? 0 : 1, ease: "linear" }}
            />
          </div>
          <span className={cn("font-mono text-[10px] font-semibold", textClass)}>
            {expired ? "bonus over" : `1.5× in ${remaining}s`}
          </span>
        </div>
      )}
    </div>
  );
}
