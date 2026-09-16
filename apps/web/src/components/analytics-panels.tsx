"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, RotateCcw, TrendingUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type AnalyticsDTO } from "@/lib/api";
import { AreaChart, TopicBars } from "@/components/charts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonChart,
  SkeletonText,
  buttonStyles,
} from "@/components/ui";

/**
 * Personal + comparative analytics (§2.7).
 *
 * Previously this returned `null` whenever the payload was empty — which is
 * why the dashboard showed a blank gap where the chart should be, with no
 * indication of whether data was missing, loading, or broken. It now has all
 * three states designed: shimmering chart skeletons while loading, an
 * "EmptyState" when there is genuinely nothing yet, and a retry path on
 * failure.
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
    <section className="grid gap-4 lg:grid-cols-2">
      {/* Score · 30 days */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Score · 30 days</CardTitle>
            <CardDescription>
              Daily points across the last 30 epochs. Hover or focus the chart and use ←/→ to
              inspect a day.
            </CardDescription>
          </div>
          {data && (
            <span className="font-mono text-xs text-fg-muted">
              <span className="font-semibold text-brand tabular-nums">
                {data.totals.score.toLocaleString()}
              </span>{" "}
              pts total
            </span>
          )}
        </CardHeader>
        <CardContent>
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
            <>
              <AreaChart
                points={data.daily.map((point) => ({ day: point.day, value: point.score }))}
                label="Daily score over the last 30 days"
                height={200}
              />

              {data.compare ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-[11px] text-fg-muted">
                  <span>
                    Today:{" "}
                    <span className="font-semibold text-fg">
                      {data.compare.rank ? `#${data.compare.rank} of ${data.compare.of}` : "unranked"}
                    </span>
                  </span>
                  {data.compare.percentile !== null && (
                    <span>
                      top{" "}
                      <span className="font-semibold text-fg">
                        {Math.max(1, 100 - (data.compare.percentile ?? 0))}%
                      </span>
                    </span>
                  )}
                  <span>
                    field average{" "}
                    <span className="font-semibold text-fg">{data.compare.avgScoreToday ?? "—"} pts</span>
                  </span>
                </div>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-[11px] text-fg-dim">
                  Peer comparison is a Pro feature — it unlocks after the daily epoch closes.
                </p>
              )}
            </>
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
      </Card>

      {/* Accuracy by topic */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Accuracy by topic</CardTitle>
            <CardDescription>
              Bands: rose below 50%, amber to 75%, emerald above — the same scale used on the
              Practice workbench.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <SkeletonText lines={5} lineClassName="h-6" />}

          {!loading && !failed && hasData && data && data.topics.length > 0 && (
            <TopicBars
              rows={data.topics.slice(0, 8).map((topic) => ({
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
              description="Attempt a few questions across topics to see where you are strong."
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
      </Card>
    </section>
  );
}
