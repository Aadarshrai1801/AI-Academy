"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, RotateCcw, TrendingUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type AnalyticsDTO } from "@/lib/api";
import { AreaChart, TopicBars } from "@/components/charts";
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonChart,
  SkeletonText,
  buttonStyles,
} from "@/components/ui";

import { CardSpotlight } from "@/components/ui/aceternity";

/**
 * Personal + comparative analytics (§2.7).
 *
 * Recomposed into an asymmetric dual-pane telemetry layout (7:5 split):
 * - Left (7 cols): 30-day score progression curve with peer benchmarking.
 * - Right (5 cols): Topic accuracy & mastery volume distribution.
 */
export function AnalyticsPanels() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<AnalyticsDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let live = true;
    void getToken()
      .then((token) => apiFetch<AnalyticsDTO>("/attempts/me/analytics?days=30", { token }))
      .then((result) => {
        if (!live) return;
        setData(result);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn, getToken, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setData(null);
    setAttempt((n) => n + 1);
  }, []);

  const loading = data === null && !failed;
  const hasData = Boolean(data && data.daily.length > 0);

  return (
    <section className="grid gap-5 lg:grid-cols-12">
      {/* Left (7 cols): Score · 30 days */}
      <CardSpotlight className="lg:col-span-7 flex flex-col justify-between">
        <div>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>Performance Vector</span>
                <span>{"//"}</span>
                <span>30-Day Window</span>
              </div>
              <CardTitle className="mt-1">Score Progression</CardTitle>
              <CardDescription>
                Daily points across the last 30 epochs. Inspect trend volatility and momentum.
              </CardDescription>
            </div>
            {data && (
              <span className="font-mono text-xs text-fg-muted">
                <span className="font-semibold text-fg tabular-nums">
                  {data.totals.score.toLocaleString()}
                </span>{" "}
                pts total
              </span>
            )}
          </CardHeader>

          <CardContent className="pt-2">
            {loading && <SkeletonChart className="h-[200px]" />}

            {failed && (
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="Could not load your analytics"
                description="This is a display problem, not a data problem — your attempts are safe."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={retry}
                  >
                    Try again
                  </Button>
                }
              />
            )}

            {!loading && !failed && hasData && data && (
              <div className="pt-1">
                <AreaChart
                  points={data.daily.map((point) => ({ day: point.day, value: point.score }))}
                  label="Daily score over the last 30 days"
                  height={220}
                />
              </div>
            )}

            {!loading && !failed && !hasData && (
              <EmptyState
                compact
                icon={<TrendingUp className="h-5 w-5" />}
                title="No scored attempts yet"
                description="Your 30-day trend appears as soon as you answer your first question."
                action={
                  <Link href="/practice" className={buttonStyles("primary", "sm")}>
                    Start a session
                  </Link>
                }
              />
            )}
          </CardContent>
        </div>

        {/* Footer telemetry */}
        {!loading && !failed && hasData && data && (
          <div className="px-6 pb-5 pt-3">
            {data.compare ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line pt-3 font-mono text-[11px] text-fg-muted">
                <span>
                  Today:{" "}
                  <span className="font-semibold text-fg">
                    {data.compare.rank ? `#${data.compare.rank} of ${data.compare.of}` : "unranked"}
                  </span>
                </span>
                {data.compare.percentile !== null && (
                  <span className="rounded bg-surface-3 px-2 py-0.5 text-fg">
                    top{" "}
                    <span className="font-semibold">
                      {Math.max(1, 100 - (data.compare.percentile ?? 0))}%
                    </span>
                  </span>
                )}
                <span>
                  cohort average{" "}
                  <span className="font-semibold text-fg">{data.compare.avgScoreToday ?? "—"} pts</span>
                </span>
              </div>
            ) : (
              <p className="border-t border-line pt-3 font-mono text-[11px] text-fg-dim">
                Peer comparison benchmark unlocks after the daily epoch closes at 00:00 UTC.
              </p>
            )}
          </div>
        )}
      </CardSpotlight>

      {/* Right (5 cols): Accuracy by topic */}
      <CardSpotlight className="lg:col-span-5 flex flex-col justify-between">
        <div>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>Knowledge Domain</span>
                <span>{"//"}</span>
                <span>Breakdown</span>
              </div>
              <CardTitle className="mt-1">Topic Mastery</CardTitle>
              <CardDescription>
                Volume and accuracy distribution across curriculum tracks.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            {loading && <SkeletonText lines={5} lineClassName="h-6" />}

            {!loading && !failed && hasData && data && data.topics.length > 0 && (
              <TopicBars
                rows={data.topics.slice(0, 7).map((topic) => ({
                  topic: topic.topic,
                  attempts: topic.attempts,
                  correct: topic.correct,
                  accuracy: topic.accuracy,
                }))}
              />
            )}

            {!loading && !failed && hasData && data?.topics.length === 0 && (
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="No topic breakdown yet"
                description="Attempt questions across different topics to see your mastery matrix."
              />
            )}

            {!loading && !failed && !hasData && (
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="Nothing to break down yet"
                description="Topic accuracy fills in once you have scored attempts."
              />
            )}
          </CardContent>
        </div>

        <div className="px-6 pb-5 pt-3">
          <div className="border-t border-line pt-3 font-mono text-[10px] text-fg-dim flex items-center justify-between">
            <span>Dimmed: &lt;50% accuracy</span>
            <span className="text-fg font-medium">Elevated: &gt;75% accuracy</span>
          </div>
        </div>
      </CardSpotlight>
    </section>
  );
}
