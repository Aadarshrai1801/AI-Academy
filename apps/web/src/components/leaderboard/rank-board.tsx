"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Crown, Flame, Medal, Search, Trophy, Zap } from "lucide-react";
import { API_URL, type BoardEntry } from "@/lib/api";
import { useTelemetry } from "@/lib/telemetry";
import { SPRING } from "@/lib/motion";

const REFRESH_MS = 30_000;

export interface RankBoardProps {
  initialEntries: BoardEntry[];
  asideSlot?: ReactNode;
}

export function RankBoard({ initialEntries, asideSlot }: RankBoardProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const reduced = useReducedMotion();
  const telemetry = useTelemetry();

  const userRank = telemetry.summary?.rank.rank ?? null;
  const userScore = telemetry.summary?.rank.score ?? 0;
  const userStreak = telemetry.summary?.streak.current ?? 0;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard/daily?limit=50`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { entries?: BoardEntry[] };
      if (Array.isArray(data.entries)) {
        setEntries(data.entries);
        setLive(true);
      }
    } catch {
      /* transient: keep previous entries */
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const topThree = useMemo(() => entries.slice(0, 3), [entries]);
  const remaining = useMemo(() => entries.slice(3), [entries]);

  const filteredRemaining = useMemo(() => {
    if (!search.trim()) return remaining;
    const query = search.toLowerCase().trim();
    return remaining.filter((item) => item.username.toLowerCase().includes(query));
  }, [remaining, search]);

  // Podium arrangement: [2nd, 1st, 3rd] for desktop podium visual hierarchy
  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  return (
    <div className="relative space-y-8">
      {/* Grand Podium Showcase */}
      {topThree.length > 0 && (
        <div className="relative">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-fg" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                Today&apos;s Epoch Podium
              </span>
            </div>
            <span className="font-mono text-[11px] text-fg-dim">
              {live ? "Live Sync Active" : "Epoch in progress"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
            {/* Runner Up: 2nd Place (Left on Desktop) */}
            {second && (
              <motion.div
                layout
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.layout}
                className="relative order-2 md:order-1 flex flex-col justify-between rounded-card border border-line-strong bg-surface-2 p-5 shadow-card md:h-[230px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-fg/80">
                      <Medal className="h-4 w-4 text-fg" />
                      RANK #02
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                      Runner-up
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-3 font-mono text-sm font-bold text-fg shadow-xs">
                      {second.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fg">
                        {second.username}
                      </span>
                      <span className="block font-mono text-[11px] text-fg-muted">Contender</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 font-mono">
                  <span className="text-[11px] text-fg-muted">Daily Score</span>
                  <span className="text-base font-semibold tabular-nums text-fg">
                    {second.score.toLocaleString()} pts
                  </span>
                </div>
              </motion.div>
            )}

            {/* Champion: 1st Place (Center elevated on Desktop) */}
            {first && (
              <motion.div
                layout
                initial={reduced ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING.layout}
                className="relative order-1 md:order-2 flex flex-col justify-between rounded-card border-2 border-brand bg-surface-2 p-6 shadow-lift md:-mt-3 md:h-[260px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-extrabold text-fg">
                      <Crown className="h-4 w-4 text-warning" />
                      RANK #01
                    </span>
                    <span className="rounded-full border border-brand/25 bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-ink">
                      Epoch Leader
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3.5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-brand bg-brand font-mono text-base font-extrabold text-on-brand shadow-sm">
                      {first.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-base font-bold text-fg">
                        {first.username}
                      </span>
                      <span className="block font-mono text-xs text-fg-muted">
                        Defending #1 in current epoch
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-3 font-mono">
                  <span className="text-xs text-fg-muted">Leading Score</span>
                  <span className="text-xl font-bold tabular-nums text-fg">
                    {first.score.toLocaleString()} pts
                  </span>
                </div>
              </motion.div>
            )}

            {/* Third Place (Right on Desktop) */}
            {third && (
              <motion.div
                layout
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.layout}
                className="relative order-3 flex flex-col justify-between rounded-card border border-line bg-surface-2 p-5 shadow-card md:h-[220px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg-muted">
                      <Medal className="h-4 w-4 text-fg-muted" />
                      RANK #03
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                      Third
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface-3 font-mono text-sm font-semibold text-fg-dim">
                      {third.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {third.username}
                      </span>
                      <span className="block font-mono text-[11px] text-fg-muted">Podium</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 font-mono">
                  <span className="text-[11px] text-fg-muted">Daily Score</span>
                  <span className="text-base font-semibold tabular-nums text-fg">
                    {third.score.toLocaleString()} pts
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Main Dual Rail Split: Rank Table (7 cols) + Sticky Daily Gauntlet (5 cols) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Live Scoreboard (7 cols) */}
        <section className="space-y-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-fg">
              <span>All Ranked Engineers</span>
              <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[10px] text-fg-muted">
                {entries.length} active
              </span>
            </div>

            {/* Filter / Search input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-fg-dim" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search engineer…"
                className="h-8 w-full rounded-md border border-line bg-surface-2 pl-8 pr-3 font-mono text-xs text-fg placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/20 outline-none shadow-xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-card">
            <div className="flex items-center justify-between border-b border-line bg-surface-1 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
              <span>Rank</span>
              <span>Engineer</span>
              <span>Daily Score</span>
            </div>

            <div className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {filteredRemaining.map((entry) => (
                  <motion.div
                    key={entry.userId}
                    layout
                    initial={reduced ? false : { opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING.layout}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-3/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-fg-dim">
                        #{entry.rank.toString().padStart(2, "0")}
                      </span>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface-3 font-mono text-[10px] font-medium text-fg">
                        {entry.username.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate text-sm font-medium text-fg">
                        {entry.username}
                      </span>
                    </div>

                    <div className="shrink-0 font-mono text-xs font-semibold tabular-nums text-fg">
                      {entry.score.toLocaleString()}
                      <span className="text-fg-dim"> pts</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredRemaining.length === 0 && (
                <div className="px-4 py-8 text-center font-mono text-xs text-fg-muted">
                  No engineers matching &ldquo;{search}&rdquo; in today&apos;s epoch.
                </div>
              )}
            </div>
          </div>

          <p className="font-mono text-[10px] text-fg-dim">
            {live
              ? "Live — updates every 30s while focused."
              : "Synchronized with global Redis epoch."}
          </p>
        </section>

        {/* Right Column: Sticky Daily Gauntlet Rail (5 cols) */}
        {asideSlot && (
          <aside className="lg:sticky lg:top-20 lg:col-span-5 space-y-4">
            {asideSlot}
          </aside>
        )}
      </div>

      {/* Floating Sticky Personal Standing Dock */}
      <div className="sticky bottom-4 z-30 mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3 rounded-full border border-line-strong bg-surface-2/95 px-5 py-2.5 backdrop-blur-md shadow-lift">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg font-mono text-xs font-bold shadow-xs">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-fg">
                  {userRank ? `Rank #${userRank}` : "Unranked"}
                </span>
                <span className="text-fg-dim text-[10px]">·</span>
                <span className="font-mono text-xs text-fg-muted">
                  {userScore} pts today
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-fg-dim">
                <Flame className="h-3 w-3 text-warning" />
                <span>{userStreak}d streak</span>
              </div>
            </div>
          </div>

          <Link
            href="/practice"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 font-mono text-xs font-semibold text-on-brand shadow-sm hover:bg-brand-strong active:scale-[0.98] transition-all"
          >
            <span>Climb Rank</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
