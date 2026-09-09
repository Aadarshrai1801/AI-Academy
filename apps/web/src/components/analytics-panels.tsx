"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type AnalyticsDTO } from "@/lib/api";
import { BarList, Sparkline } from "@/components/charts";

/** Personal + comparative analytics (spec §1: personal for all, compare for Pro). */
export function AnalyticsPanels() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<AnalyticsDTO | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    void getToken()
      .then((t) => apiFetch<AnalyticsDTO>("/attempts/me/analytics?days=30", { token: t }))
      .then((r) => {
        if (live) setData(r);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  if (!data || data.daily.length === 0) return null;
  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
        <h2 className="text-sm font-semibold">Score · 30 days</h2>
        <div className="mt-2">
          <Sparkline values={data.daily.map((d) => d.score)} label={`${data.totals.score} pts total`} />
        </div>
        {data.compare ? (
          <p className="mt-2 text-xs text-zinc-500">
            Today: {data.compare.rank ? `#${data.compare.rank} of ${data.compare.of}` : "unranked"}
            {data.compare.percentile !== null ? ` · top ${100 - (data.compare.percentile ?? 0)}%` : ""} ·
            field avg {data.compare.avgScoreToday ?? "—"} pts
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Peer comparison updates after daily epoch closes.
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">Accuracy by topic</h2>
        <div className="mt-3">
          <BarList
            rows={data.topics.slice(0, 6).map((t) => ({
              label: t.topic,
              value: Math.round((t.accuracy ?? 0) * 100),
              hint: `${Math.round((t.accuracy ?? 0) * 100)}% · ${t.attempts} att.`,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
