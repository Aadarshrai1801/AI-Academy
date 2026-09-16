"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { API_URL, type BoardEntry } from "@/lib/api";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Daily epoch scoreboard (§2.3).
 *
 * A client component so rank changes can be *animated*: rows carry `layout`,
 * so when a poll or a window refocus produces a new order, Framer Motion runs
 * a FLIP transition and rows visibly slide to their new positions instead of
 * jumping. That is the whole point of putting this behind a client boundary —
 * the initial data still arrives server-rendered for first paint.
 *
 * The podium is differentiated (crown for #1, medals for #2/#3, gold/silver/
 * bronze accents) rather than being three more rows that happen to sort first.
 */
const PODIUM = [
  {
    accent: "border-brand/45 bg-brand-soft",
    badge: "text-brand",
    icon: Crown,
    title: "Champion",
  },
  {
    accent: "border-line-strong bg-surface-3",
    badge: "text-fg-muted",
    icon: Medal,
    title: "Runner-up",
  },
  {
    accent: "border-warning/40 bg-warning-soft",
    badge: "text-warning",
    icon: Medal,
    title: "Third",
  },
] as const;

const REFRESH_MS = 30_000;

export function RankBoard({ initialEntries }: { initialEntries: BoardEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [live, setLive] = useState(false);
  const reduced = useReducedMotion();

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
      /* transient: keep the last good board on screen */
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

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <div>
      {/* Podium */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <AnimatePresence initial={false}>
          {topThree.map((entry, index) => {
            const style = PODIUM[Math.min(index, PODIUM.length - 1)];
            const Icon = style.icon;
            return (
              <motion.div
                key={entry.userId}
                layout
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING.layout}
                className={cn(
                  "relative flex flex-col justify-between rounded-card border p-5 shadow-card",
                  style.accent,
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("flex items-center gap-1.5 font-mono text-xs font-bold", style.badge)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      RANK #{entry.rank.toString().padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                      {style.title}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface-2 font-mono text-sm font-bold text-fg">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fg">
                        {entry.username}
                      </span>
                      <span className="block font-mono text-[11px] text-fg-muted">
                        {index === 0 ? "Leading the epoch" : "On the podium"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline justify-between border-t border-line pt-3 font-mono">
                  <span className="text-[11px] text-fg-muted">Daily score</span>
                  <span className="text-base font-semibold tabular-nums text-fg">
                    {entry.score.toLocaleString()} pts
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Remaining ranks */}
      {remaining.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-card border border-line bg-surface-2">
          <div className="flex items-center justify-between border-b border-line bg-surface-1 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
              Rank
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
              Engineer · Points
            </span>
          </div>

          <div className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {remaining.map((entry) => (
                <motion.div
                  key={entry.userId}
                  layout
                  initial={reduced ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING.layout}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-3/60"
                >
                  <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-fg-dim">
                    #{entry.rank.toString().padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                    {entry.username}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-fg">
                    {entry.score.toLocaleString()}
                    <span className="text-fg-dim"> pts</span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] text-fg-dim">
        {live ? "Live — updates every 30s while this tab is focused." : "Updates every 30s while this tab is focused."}
      </p>
    </div>
  );
}
