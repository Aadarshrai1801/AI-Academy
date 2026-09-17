"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
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
    <section className="grid gap-5 lg:grid-cols-2">
      {/* Left: Score · 30 days */}
      <CardSpotlight className="flex flex-col justify-between">
        <div>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>Your Progress</span>
                <span>{"//"}</span>
                <span>Last 30 Days</span>
              </div>
              <CardTitle className="mt-1">Score History</CardTitle>
              <CardDescription>
                Your daily points over the last 30 days. Watch your score grow as you practice!
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
                title="Could not load your progress"
                description="This is just a display issue — your scores are safe."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={retry}
                  >
                    Try Again
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
                title="No scored questions yet"
                description="Your 30-day progress appears as soon as you answer your first question."
                action={
                  <Link href="/practice" className={buttonStyles("primary", "sm")}>
                    Start Practicing
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
                  group average{" "}
                  <span className="font-semibold text-fg">{data.compare.avgScoreToday ?? "—"} pts</span>
                </span>
              </div>
            ) : (
              <p className="border-t border-line pt-3 font-mono text-[11px] text-fg-dim">
                Group comparisons unlock at the end of the day.
              </p>
            )}
          </div>
        )}
      </CardSpotlight>

      {/* Right: Accuracy by topic */}
      <CardSpotlight className="flex flex-col justify-between">
        <div>
          <CardHeader>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>Subject Skills</span>
                <span>{"//"}</span>
                <span>Breakdown</span>
              </div>
              <CardTitle className="mt-1">Topic Mastery</CardTitle>
              <CardDescription>
                How well you understand each topic and skill.
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
                description="Answer questions across different topics to see your progress here."
              />
            )}

            {!loading && !failed && !hasData && (
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="Nothing to break down yet"
                description="Topic scores will appear once you start answering questions."
              />
            )}
          </CardContent>
        </div>

        <div className="px-6 pb-5 pt-3">
          <div className="border-t border-line pt-3 font-mono text-[10px] text-fg-dim flex items-center justify-between">
            <span>Keep practicing: &lt;50%</span>
            <span className="text-fg font-medium">Mastered: &gt;75%</span>
          </div>
        </div>
      </CardSpotlight>
    </section>
  );
}
