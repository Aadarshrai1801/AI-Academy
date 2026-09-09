"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch } from "@/lib/api";
import { BarList } from "@/components/charts";

interface PlatformStats {
  days: number;
  perDay: Array<{ day: string; dau: number; attempts: number; score: number }>;
  totals: {
    attempts: number;
    newUsers: number;
    aiQueries: number;
    aiHitRate: number | null;
    videosReady: number;
    callMinutes: number;
  };
  revenue: { configured: boolean; activeSubs: number | null; mrrUsd: number | null };
}

/** Platform analytics (spec §1 admin view). */
export default function AdminAnalyticsPage() {
  const { getToken, isLoaded } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await apiFetch<PlatformStats>("/admin/analytics?days=14", {
        token: await getToken(),
      });
      setStats(s);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? "Admin role required."
          : e instanceof Error
            ? `Could not load analytics: ${e.message}`
            : "Load failed.",
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold">Admin · Platform</h1>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              { k: "Attempts", v: `${stats.totals.attempts}` },
              { k: "New users", v: `${stats.totals.newUsers}` },
              {
                k: "AI hit rate",
                v: stats.totals.aiHitRate === null ? "—" : `${Math.round(stats.totals.aiHitRate * 100)}%`,
              },
              { k: "Videos ready", v: `${stats.totals.videosReady}` },
              { k: "Call minutes", v: `${stats.totals.callMinutes}` },
              {
                k: "MRR",
                v: stats.revenue.configured
                  ? stats.revenue.mrrUsd === null
                    ? "Stripe error"
                    : `$${stats.revenue.mrrUsd}`
                  : "Stripe off",
              },
              {
                k: "Active subs",
                v: stats.revenue.activeSubs === null ? "—" : `${stats.revenue.activeSubs}`,
              },
              { k: "Window", v: `${stats.days}d` },
            ].map((c) => (
              <div
                key={c.k}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="text-xs uppercase tracking-widest text-zinc-500">{c.k}</div>
                <div className="mt-1 font-semibold">{c.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Daily active users</h2>
            <div className="mt-3">
              <BarList rows={stats.perDay.map((d) => ({ label: d.day.slice(5), value: d.dau, hint: `${d.dau} users · ${d.attempts} att.` }))} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
