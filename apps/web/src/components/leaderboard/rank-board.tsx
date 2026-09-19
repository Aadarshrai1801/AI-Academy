/**
 * RankBoard — a competitive table with a podium (design plan §4.3).
 *
 * Why this looks this way:
 * - This screen answers "how do I compare today?", not "am I growing?" — so
 *   it deliberately does NOT reuse the progress path/card language. It is a
 *   table with ordinal numbers (ranks are real data, so numbering is honest).
 * - The current learner's row is always visible: the standing dock pins to
 *   the viewport bottom, because hunting for yourself at rank #4,000 is the
 *   moment the feature stops motivating.
 * - The reserved outcome colors stay out of the podium: other people's ranks
 *   aren't your progress. Champion emphasis is ink + border weight.
 */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Crown, Flame, Medal, Search, Trophy, Zap } from "lucide-react";
import { API_URL, type BoardEntry } from "@/lib/api";
import { useTelemetry } from "@/lib/telemetry";
import { buttonStyles } from "@/components/ui";

const REFRESH_MS = 30_000;

export interface RankBoardProps {
  initialEntries: BoardEntry[];
  asideSlot?: ReactNode;
}

export function RankBoard({ initialEntries, asideSlot }: RankBoardProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
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
      {/* Podium — ordinal data, so the ranking treatment is justified here. */}
      {topThree.length > 0 && (
        <div className="relative">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-fg" />
              <span className="text-sm font-semibold text-fg">Today&apos;s top learners</span>
            </div>
            <span className="text-[11px] text-fg-dim">
              {live ? "Live — updates every 30s" : "Updates live through the day"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
            {/* Runner-up (left on desktop). Flat, ink numerals: rank is data. */}
            {second && (
              <div className="surface-card relative order-2 flex flex-col justify-between p-5 md:order-1 md:h-[210px]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-fg">
                      <Medal className="h-4 w-4 text-fg-muted" />
                      #2
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-3 font-mono text-sm font-bold text-fg">
                      {second.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-fg">
                      {second.username}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-xs text-fg-muted">Daily points</span>
                  <span className="font-mono text-base font-semibold tabular-nums text-fg">
                    {second.score.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Champion (elevated on desktop). Ink border + fill = emphasis
                on the ranking itself, not on the learner's own progress. */}
            {first && (
              <div className="surface-card relative order-1 flex flex-col justify-between border-2 border-fg p-6 md:order-2 md:-mt-3 md:h-[240px]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-fg">
                      <Crown className="h-4 w-4 text-fg" />
                      #1
                    </span>
                    <span className="text-[11px] text-fg-muted">today&apos;s leader</span>
                  </div>

                  <div className="mt-4 flex items-center gap-3.5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-fg font-mono text-base font-bold text-on-brand">
                      {first.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate text-base font-bold text-fg">
                      {first.username}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-xs text-fg-muted">Leading score</span>
                  <span className="font-mono text-xl font-bold tabular-nums text-fg">
                    {first.score.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Third (right on desktop). */}
            {third && (
              <div className="surface-card relative order-3 flex flex-col justify-between p-5 md:h-[200px]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-fg-muted">
                      <Medal className="h-4 w-4 text-fg-dim" />
                      #3
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface-3 font-mono text-sm font-semibold text-fg-dim">
                      {third.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-fg">
                      {third.username}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-xs text-fg-muted">Daily points</span>
                  <span className="font-mono text-base font-semibold tabular-nums text-fg">
                    {third.score.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Symmetrical Split: Scoreboard + Sticky Daily Challenge Rail */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Left Column: Live Scoreboard */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Today&apos;s rankings</span>
              <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[11px] text-fg-muted">
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
                placeholder="Search learner…"
                className="h-8 w-full rounded-btn border border-line bg-surface-2 pl-8 pr-3 text-xs text-fg placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/20 outline-none"
              />
            </div>
          </div>

          <div className="overflow-hidden surface-card">
            <div className="grid grid-cols-[3.5rem_1fr_auto] items-center border-b border-line bg-surface-1 px-4 py-2.5 text-[11px] font-medium text-fg-dim">
              <span>Rank</span>
              <span>Learner</span>
              <span className="text-right">Points</span>
            </div>

            <div className="divide-y divide-line">
              {filteredRemaining.map((entry) => (
                <div
                  key={entry.userId}
                  className="grid grid-cols-[3.5rem_1fr_auto] items-center px-4 py-3 transition-colors hover:bg-surface-3/50"
                >
                  <span className="font-mono text-xs tabular-nums text-fg-dim">
                    #{entry.rank}
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface-3 font-mono text-[10px] font-medium text-fg">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-medium text-fg">
                      {entry.username}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs font-semibold tabular-nums text-fg">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              ))}

              {filteredRemaining.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-fg-muted">
                  No learners matching &ldquo;{search}&rdquo; today.
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-fg-dim">
            {live
              ? "Live — updates every 30s while this tab is focused."
              : "Updates live through the day."}
          </p>
        </section>

        {/* Right Column: Sticky Daily Challenge Rail */}
        {asideSlot && (
          <aside className="lg:sticky lg:top-20 space-y-4">
            {asideSlot}
          </aside>
        )}
      </div>

      {/* Pinned self row — the learner never scrolls to find themselves. A
          floating layer, so this is one of the few allowed elevations. */}
      <div className="sticky bottom-4 z-30 mx-auto max-w-2xl">
        <div className="surface-card flex items-center justify-between gap-3 border-line-strong bg-surface-2/95 px-4 py-2.5 shadow-lift backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-fg">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums text-fg">
                  {userRank ? `#${userRank}` : "Unranked"}
                </span>
                <span className="text-xs text-fg-muted">you</span>
                <span className="text-xs text-fg-dim">·</span>
                <span className="font-mono text-xs tabular-nums text-fg">
                  {userScore.toLocaleString()} pts
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-fg-dim">
                <Flame className="h-3 w-3 text-growth" />
                <span>{userStreak}-day streak</span>
              </div>
            </div>
          </div>

          <Link href="/practice" className={buttonStyles("primary", "sm")}>
            Practice
          </Link>
        </div>
      </div>
    </div>
  );
}
