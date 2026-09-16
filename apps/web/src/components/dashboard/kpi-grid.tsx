"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Flame, TrendingUp, Trophy } from "lucide-react";
import type { SummaryDTO } from "@/lib/api";
import { AnimatedNumber, Badge, Card, CardEyebrow, ProgressRing, accuracyTone } from "@/components/ui";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/cn";

/**
 * Dashboard KPI grid (§2.7).
 *
 * Values count up from zero on load via `<AnimatedNumber>` (the single biggest
 * "premium dashboard" signal), and read from shared telemetry so they stay
 * live after a graded attempt — falling back to the server-rendered summary
 * for an instant first paint.
 *
 * Two cards carry real state rather than a static label:
 * - **Streak** — the flame grows and glows with streak length, and the card
 *   raises a warning when the epoch is about to close and today is unlogged.
 * - **System status** — a genuine `/health` probe with a heartbeat ring, not
 *   the hardcoded "ONLINE" the previous version rendered.
 */

/** Hoisted so a re-render cannot restart the breathing loop mid-cycle. */
const FLAME_PULSE = { scale: [1, 1.08, 1] };

export interface DashboardKpisProps {
  initialSummary: SummaryDTO | null;
  /**
   * Hours until the 00:00 UTC epoch reset, computed per request on the
   * server. Passed in rather than derived from `Date.now()` during render so
   * SSR and hydration cannot disagree, and no effect/setState is needed.
   */
  hoursLeftInEpoch: number;
}

export function DashboardKpis({ initialSummary, hoursLeftInEpoch }: DashboardKpisProps) {
  const telemetry = useTelemetry();
  const summary = telemetry.summary ?? initialSummary;
  const reduced = useReducedMotion();

  const current = summary?.streak.current ?? 0;
  const longest = summary?.streak.longest ?? 0;
  const todayAttempts = summary?.today.attempts ?? 0;
  const todayScore = summary?.today.score ?? 0;
  const accuracy = summary?.today.accuracy ?? null;
  const rank = summary?.rank.rank ?? null;
  const rankScore = summary?.rank.score ?? 0;
  const totalPoints = summary?.total.points ?? 0;

  const todayLogged = todayAttempts > 0;
  const streakAtRisk = current > 0 && !todayLogged && hoursLeftInEpoch < 4;

  // Flame intensity saturates at two weeks — beyond that it is already "on fire".
  const intensity = Math.min(current / 14, 1);
  const flameSize = 18 + Math.round(intensity * 10);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Streak */}
      <Card
        className={cn(
          "p-5",
          streakAtRisk ? "border-warning/45" : current > 0 ? "border-brand/35" : undefined,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Active streak</CardEyebrow>
          <motion.span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              current > 0 ? "bg-brand-soft text-brand" : "bg-surface-3 text-fg-dim",
            )}
            animate={current > 0 && !reduced ? FLAME_PULSE : undefined}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={
              current > 0
                ? { filter: `drop-shadow(0 0 ${4 + intensity * 10}px var(--brand))` }
                : undefined
            }
          >
            <Flame style={{ width: flameSize, height: flameSize }} aria-hidden="true" />
          </motion.span>
        </div>

        <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          <AnimatedNumber value={current} suffix="d" />
        </div>

        <div className="mt-1 text-xs text-fg-muted">
          {streakAtRisk ? (
            <span className="inline-flex items-center gap-1.5 text-warning">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden="true" />
              At risk — {Math.max(1, Math.floor(hoursLeftInEpoch))}h left to log a question
            </span>
          ) : todayLogged ? (
            <span className="text-success">Today banked · best {longest}d</span>
          ) : (
            <>Best streak {longest}d</>
          )}
        </div>
      </Card>

      {/* Total points */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Total points</CardEyebrow>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          <AnimatedNumber value={totalPoints} suffix=" pts" />
        </div>
        <div className="mt-1 text-xs text-fg-muted">Cumulative across all epochs</div>
      </Card>

      {/* Today's score */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Today&apos;s score</CardEyebrow>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          <AnimatedNumber value={todayScore} suffix=" pts" />
        </div>
        <div className="mt-1 text-xs text-fg-muted">
          {todayAttempts} attempt{todayAttempts === 1 ? "" : "s"} recorded today
        </div>
      </Card>

      {/* Accuracy */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Accuracy rate</CardEyebrow>
          <ProgressRing
            value={accuracy === null ? 0 : Math.round(accuracy * 100)}
            max={100}
            size={36}
            strokeWidth={4}
            tone={accuracyTone(accuracy)}
            label="Today's accuracy"
          >
            {accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`}
          </ProgressRing>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          {accuracy === null ? "—" : <AnimatedNumber value={accuracy * 100} suffix="%" />}
        </div>
        <div className="mt-1 text-xs text-fg-muted">Correct answers today</div>
      </Card>

      {/* Rank */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <CardEyebrow>Daily ranking</CardEyebrow>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
            <Trophy className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          {rank === null ? (
            <span className="text-base font-medium text-fg-muted">Unranked</span>
          ) : (
            <AnimatedNumber value={rank} prefix="#" />
          )}
        </div>
        <div className="mt-1 text-xs text-fg-muted">
          {rank === null ? "Solve one question to claim a rank" : `${rankScore} pts today`}
        </div>
      </Card>

      <SystemStatusCard />
    </div>
  );
}

type HealthState = "checking" | "online" | "degraded";

/**
 * Live API health indicator. Polls `/health` every 60s so the dot reflects
 * reality; a heartbeat ring (expanding + fading) signals that it is live
 * rather than a static label.
 */
function SystemStatusCard() {
  const reduced = useReducedMotion();
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (!cancelled) setState(response.ok ? "online" : "degraded");
      } catch {
        if (!cancelled) setState("degraded");
      }
    }

    void probe();
    const interval = setInterval(() => void probe(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const meta = {
    checking: { tone: "text-fg-muted", bg: "bg-fg-dim", label: "Checking", variant: "neutral" as const },
    online: { tone: "text-success", bg: "bg-success", label: "Operational", variant: "success" as const },
    degraded: { tone: "text-error", bg: "bg-error", label: "Degraded", variant: "error" as const },
  }[state];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <CardEyebrow>System status</CardEyebrow>
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3">
          <span className={cn("h-2.5 w-2.5 rounded-full", meta.bg)} aria-hidden="true" />
          {state === "online" && !reduced && (
            <span
              className={cn("absolute h-2.5 w-2.5 animate-pulse-ring rounded-full", meta.bg)}
              aria-hidden="true"
            />
          )}
        </span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-fg">
        {state === "checking" ? (
          <span className="text-base font-medium text-fg-muted">Checking…</span>
        ) : (
          <span className="text-base font-semibold">{meta.label}</span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Badge variant={meta.variant} size="sm" dot={state === "online"}>
          {state === "online" ? "Live" : state === "degraded" ? "Unreachable" : "Probing"}
        </Badge>
        <span className="text-[11px] text-fg-dim">
          {state === "degraded" ? "Answer grading may be delayed" : "Grading pipeline reachable"}
        </span>
      </div>
    </Card>
  );
}
