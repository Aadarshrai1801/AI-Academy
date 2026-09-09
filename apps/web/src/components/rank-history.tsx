"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type HistoryPoint } from "@/lib/api";
import { Sparkline } from "@/components/charts";

/** Signed-in rank history (spec §2.2: own trail free, top-context Pro). */
export function RankHistory() {
  const { getToken, isSignedIn } = useAuth();
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    void getToken()
      .then((t) => apiFetch<{ mine: HistoryPoint[] }>("/leaderboard/history?days=30", { token: t }))
      .then((r) => {
        if (live) setPoints(r.mine);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  if (!isSignedIn || !points || points.length === 0) return null;
  const ranked = points.filter((p) => p.rank !== null);
  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="font-semibold">Your last {points.length} days</h2>
      <div className="mt-3 text-zinc-950 dark:text-zinc-50">
        <Sparkline values={points.map((p) => p.score)} label="Daily score" />
      </div>
      {ranked.length > 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Best rank #{Math.min(...ranked.map((p) => p.rank as number))} · latest{" "}
          {ranked[ranked.length - 1].percentile !== null &&
          ranked[ranked.length - 1].percentile !== undefined
            ? `top ${100 - (ranked[ranked.length - 1].percentile as number)}%`
            : "unranked"}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No ranked days yet — practice to appear.</p>
      )}
    </section>
  );
}
