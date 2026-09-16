"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import type { SummaryDTO } from "@/lib/api";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Streak badge + calendar popover (§2.8).
 *
 * The badge pulses whenever the streak value actually changes — driven by
 * telemetry refreshes, so it reacts to a real graded attempt rather than a
 * timer. When today has no activity yet the badge switches to the warning tone
 * and shows an amber ring: the streak is alive but at risk (§2.7).
 *
 * The 7-day strip is derived from `streak.current` + `streak.todayCount` —
 * the previous implementation rendered a hardcoded array, which read as real
 * data and was not.
 */
/** Hoisted so a re-render cannot restart the pulse mid-flight. */
const STREAK_PULSE = { scale: [1, 1.28, 1] };
const STREAK_REST = { scale: 1 };

export function StreakBadge({ summary }: { summary: SummaryDTO | null }) {
  const [open, setOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const previousStreak = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const current = summary?.streak.current ?? 0;
  const longest = summary?.streak.longest ?? 0;
  const todayCount = summary?.streak.todayCount ?? 0;
  const todayActive = todayCount > 0;
  const atRisk = current > 0 && !todayActive;

  // Pulse only on a real change (not on first paint).
  useEffect(() => {
    if (previousStreak.current !== null && previousStreak.current !== current) {
      setPulseKey((k) => k + 1);
    }
    previousStreak.current = current;
  }, [current]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Most recent active day is today when today has activity, otherwise
   * yesterday (the streak is still alive inside its grace window).
   */  const anchorOffset = todayActive ? 0 : 1;
  const days = Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    if (daysAgo === 0) return todayActive ? "active" : "pending";
    if (daysAgo < anchorOffset) return "empty";
    return current > daysAgo - anchorOffset ? "active" : "empty";
  });

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Streak: ${current} days${atRisk ? " — today not logged yet" : ""}`}
        whileHover={reduced ? undefined : { y: -1 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={SPRING.snappy}
        className={cn(
          "flex items-center gap-1.5 rounded-full border bg-surface-2 px-2.5 py-1",
          atRisk ? "border-warning/40" : "border-line hover:border-line-strong",
        )}
      >
        <motion.span
          key={pulseKey}
          animate={pulseKey > 0 && !reduced ? STREAK_PULSE : STREAK_REST}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex"
        >
          <Flame
            className={cn("h-4 w-4", atRisk ? "text-warning" : current > 0 ? "text-brand" : "text-fg-dim")}
            aria-hidden="true"
          />
        </motion.span>
        <span className="font-mono text-xs font-medium tabular-nums text-fg">{current}d</span>
        {atRisk && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden="true" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Streak details"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING.pop}
            className="absolute top-11 right-0 z-50 w-72 rounded-card border border-line bg-surface-3 p-4 shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-sm font-semibold text-fg">Epoch continuity</span>
              <span className="font-mono text-xs font-medium text-brand tabular-nums">
                {current} day{current === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-1.5" aria-hidden="true">
              {days.map((state, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-7 flex-1 rounded-md",
                    state === "active" && "bg-brand",
                    state === "pending" && "animate-breathe border border-brand bg-brand-soft",
                    state === "empty" && "bg-surface-4",
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-fg-dim">Last 7 days</p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface-2 p-2.5">
                <div className="text-[10px] text-fg-muted">All-time peak</div>
                <div className="mt-0.5 font-mono font-medium text-fg tabular-nums">{longest} days</div>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-2.5">
                <div className="text-[10px] text-fg-muted">Today</div>
                <div
                  className={cn(
                    "mt-0.5 font-mono font-medium tabular-nums",
                    todayActive ? "text-success" : "text-warning",
                  )}
                >
                  {todayActive ? `${todayCount} logged` : "Not yet"}
                </div>
              </div>
            </div>

            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-muted">
              {atRisk
                ? "Solve one question today to keep this streak alive."
                : todayActive
                  ? "Today is banked. Come back tomorrow to extend the run."
                  : "Solve a question to start a new streak."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
