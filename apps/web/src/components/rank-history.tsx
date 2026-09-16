"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { TrendingUp } from "lucide-react";
import { apiFetch, type HistoryPoint } from "@/lib/api";
import { Sparkline } from "@/components/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui";

/**
 * Signed-in rank history (spec §2.2: own trail free, top-context Pro).
 *
 * Migrated off the pre-redesign palette (`zinc-*` plus `dark:` variants) — on a
 * light theme those classes rendered a near-invisible card, and the `dark:`
 * variants would have keyed off the OS setting rather than the app theme.
 */
export function RankHistory() {
  const { getToken, isSignedIn } = useAuth();
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    void getToken()
      .then((token) => apiFetch<{ mine: HistoryPoint[] }>("/leaderboard/history?days=30", { token }))
      .then((result) => {
        if (live) setPoints(result.mine);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  if (!isSignedIn) return null;

  const ranked = (points ?? []).filter((point) => point.rank !== null);
  const latest = ranked.at(-1);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" aria-hidden="true" />
            Your rank history
          </CardTitle>
          <CardDescription>
            {points === null
              ? "Loading your last 30 days…"
              : `Daily score across your last ${points.length} day${points.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </div>
        {latest && (
          <span className="font-mono text-xs text-fg-muted">
            Best rank <span className="font-semibold text-fg">#{Math.min(...ranked.map((p) => p.rank as number))}</span>
          </span>
        )}
      </CardHeader>

      <CardContent>
        {points !== null && points.length === 0 && (
          <EmptyState
            compact
            icon={<TrendingUp className="h-5 w-5" />}
            title="No ranked days yet"
            description="Your trend appears after your first scored day on the leaderboard."
          />
        )}

        {points !== null && points.length > 0 && (
          <>
            <div className="text-fg-muted">
              <Sparkline values={points.map((point) => point.score)} label="Daily score" />
            </div>
            {latest && (
              <p className="mt-2 text-xs text-fg-muted">
                Latest{" "}
                <span className="font-medium text-fg">
                  {latest.percentile !== null && latest.percentile !== undefined
                    ? `top ${Math.max(1, 100 - latest.percentile)}%`
                    : `rank #${latest.rank}`}
                </span>
                {latest.of > 0 && <span className="text-fg-dim"> of {latest.of}</span>}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
