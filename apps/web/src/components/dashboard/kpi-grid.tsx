"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  ShieldCheck,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { API_URL, type SummaryDTO } from "@/lib/api";
import { AnimatedNumber, Badge, CardEyebrow, ProgressRing, accuracyTone } from "@/components/ui";
import { CardSpotlight } from "@/components/ui/aceternity";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/cn";

const FLAME_PULSE = { scale: [1, 1.08, 1] };

export interface DashboardKpisProps {
  initialSummary: SummaryDTO | null;
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

  const intensity = Math.min(current / 14, 1);
  const flameSize = 20 + Math.round(intensity * 12);

  // Daily target: default 5 questions for full daily mastery
  const dailyTarget = 5;
  const goalProgress = Math.min(todayAttempts / dailyTarget, 1);

  // 7-day micro nodes representation for streak timeline
  const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
  const currentDayIdx = (new Date().getDay() + 6) % 7; // 0 for Mon, 6 for Sun

  return (
    <div className="space-y-4">
      {/* Primary Asymmetric Bento Command Row */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: 8-Col Practice Velocity & Streak Engine Hero */}
        <CardSpotlight
          className={cn(
            "relative overflow-hidden p-6 lg:col-span-8 flex flex-col justify-between transition-all",
            streakAtRisk
              ? "border-warning/40 shadow-lift"
              : current > 0
                ? "border-line-strong"
                : "border-line",
          )}
        >
          {/* Subtle ambient blur */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-surface-3 blur-3xl opacity-50" />

          <div>
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2 w-2 rounded-full bg-brand shadow-xs" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
                  Practice Velocity &amp; Streak Engine
                </span>
              </div>

              {/* Epoch Countdown Chip */}
              <div className="flex items-center gap-2 rounded-full border border-line bg-surface-3 px-3 py-1 font-mono text-[11px] text-fg-muted">
                <Clock className="h-3 w-3 text-fg-dim" />
                <span>
                  {Math.max(1, Math.floor(hoursLeftInEpoch))}h left in UTC epoch
                </span>
              </div>
            </div>

            {/* Middle: Streak Metric & 7-Node Heatmap */}
            <div className="mt-6 grid gap-6 sm:grid-cols-12 items-center">
              {/* Streak Big Number */}
              <div className="sm:col-span-6 flex items-center gap-4">
                <motion.span
                  className={cn(
                    "grid h-16 w-16 shrink-0 place-items-center rounded-2xl border transition-all",
                    current > 0
                      ? "border-line-strong bg-surface-3 text-fg shadow-xs"
                      : "border-line bg-surface-1 text-fg-dim",
                  )}
                  animate={current > 0 && !reduced ? FLAME_PULSE : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Flame style={{ width: flameSize, height: flameSize }} className="fill-warning/20 text-warning" aria-hidden="true" />
                </motion.span>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-fg">
                      <AnimatedNumber value={current} />
                    </span>
                    <span className="font-mono text-lg font-semibold text-fg-muted">days</span>
                  </div>
                  <p className="font-mono text-xs text-fg-muted mt-0.5">
                    {streakAtRisk ? (
                      <span className="text-state-warning-ink font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                        Unlogged today · at risk
                      </span>
                    ) : todayLogged ? (
                      <span className="text-fg font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Today logged · best {longest}d
                      </span>
                    ) : (
                      <>Active streak · best {longest}d</>
                    )}
                  </p>
                </div>
              </div>

              {/* 7-Node Micro Track & Daily Target */}
              <div className="sm:col-span-6 rounded-xl border border-line bg-surface-1 p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-mono text-fg-muted mb-2.5">
                  <span className="font-semibold text-fg">Weekly Continuity</span>
                  <span>{todayAttempts}/{dailyTarget} solved today</span>
                </div>

                {/* 7-day strip */}
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {daysOfWeek.map((day, idx) => {
                    const isToday = idx === currentDayIdx;
                    const isPast = idx < currentDayIdx;
                    const isCompleted = isPast || (isToday && todayLogged);

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <span className="font-mono text-[10px] text-fg-dim">{day}</span>
                        <div
                          className={cn(
                            "h-5 w-full rounded-md border flex items-center justify-center transition-all",
                            isCompleted
                              ? "border-brand bg-brand text-on-brand font-bold shadow-xs"
                              : isToday
                                ? "border-line-strong bg-surface-3 animate-pulse"
                                : "border-line bg-surface-2",
                          )}
                        >
                          {isCompleted && <span className="h-1.5 w-1.5 rounded-full bg-surface-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Target Progress Bar */}
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-brand shadow-xs transition-all duration-500"
                    style={{ width: `${Math.round(goalProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2 font-mono text-xs text-fg-muted">
              <ShieldCheck className="h-4 w-4 text-fg" />
              <span>{todayLogged ? "Streak protected for epoch" : "Complete 1 question to lock streak"}</span>
            </div>

            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-mono text-xs font-semibold text-on-brand shadow-sm hover:bg-brand-strong active:scale-[0.98] transition-all"
            >
              <span>{todayLogged ? "Continue Training" : "Launch Daily Practice"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardSpotlight>

        {/* Right: 4-Col Standings & Precision Telemetry */}
        <CardSpotlight className="p-6 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <CardEyebrow>Daily Telemetry</CardEyebrow>
              <Trophy className="h-4 w-4 text-fg" />
            </div>

            {/* Precision Donut & Rank Split */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  Epoch Standing
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  {rank === null ? (
                    <span className="text-xl font-bold text-fg-muted">Unranked</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold tracking-tight text-fg">#{rank}</span>
                      <span className="font-mono text-xs text-fg-dim">of today</span>
                    </>
                  )}
                </div>
                <span className="mt-0.5 font-mono text-[11px] text-fg-muted">
                  {rankScore} pts scored today
                </span>
              </div>

              {/* Progress Ring */}
              <div className="flex flex-col items-center">
                <ProgressRing
                  value={accuracy === null ? 0 : Math.round(accuracy * 100)}
                  max={100}
                  size={56}
                  strokeWidth={5}
                  tone={accuracyTone(accuracy)}
                  label="Today's accuracy"
                >
                  <span className="font-mono text-xs font-bold text-fg">
                    {accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`}
                  </span>
                </ProgressRing>
                <span className="mt-1 font-mono text-[10px] text-fg-dim">Accuracy</span>
              </div>
            </div>
          </div>

          {/* Inline Health Probe */}
          <div className="mt-6 border-t border-line pt-4">
            <SystemStatusCard />
          </div>
        </CardSpotlight>
      </div>

      {/* Row 2: Secondary Telemetry Duo */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Total Points */}
        <CardSpotlight className="p-4">
          <div className="flex items-center justify-between text-fg-muted">
            <span className="font-mono text-[11px] uppercase tracking-wider">Cumulative Points</span>
            <TrendingUp className="h-3.5 w-3.5 text-fg" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-fg">
            <AnimatedNumber value={totalPoints} suffix=" pts" />
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-fg-dim">Across all historical epochs</div>
        </CardSpotlight>

        {/* Today's Score */}
        <CardSpotlight className="p-4">
          <div className="flex items-center justify-between text-fg-muted">
            <span className="font-mono text-[11px] uppercase tracking-wider">Today&apos;s Points</span>
            <Activity className="h-3.5 w-3.5 text-fg" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-fg">
            <AnimatedNumber value={todayScore} suffix=" pts" />
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-fg-dim">
            From {todayAttempts} attempt{todayAttempts === 1 ? "" : "s"} today
          </div>
        </CardSpotlight>
      </div>
    </div>
  );
}

type HealthState = "checking" | "online" | "degraded";

function SystemStatusCard() {
  const reduced = useReducedMotion();
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const response = await fetch(`${API_URL}/health`, {
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
    checking: {
      label: "Probing API",
      dot: "bg-state-info/50",
      variant: "outline" as const,
      desc: "Checking node heartbeat…",
    },
    online: {
      label: "Pipeline Live",
      dot: "bg-success shadow-xs",
      variant: "success" as const,
      desc: "Grading cluster operational",
    },
    degraded: {
      label: "Degraded",
      dot: "bg-error/40 border border-dashed border-error/50",
      variant: "warning" as const,
      desc: "Evaluation may experience latency",
    },
  }[state];

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-3">
          <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden="true" />
          {state === "online" && !reduced && (
            <span
              className="absolute h-2 w-2 animate-pulse-ring rounded-full bg-success/30"
              aria-hidden="true"
            />
          )}
        </span>
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-fg leading-tight">
            {meta.label}
          </div>
          <div className="font-mono text-[10px] text-fg-dim leading-tight">
            {meta.desc}
          </div>
        </div>
      </div>

      <Badge variant={meta.variant} size="sm" dot={state === "online"}>
        {state === "online" ? "99.9%" : state === "degraded" ? "Lag" : "Init"}
      </Badge>
    </div>
  );
}
