"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Activity,
  BarChart3,
  CircleAlert,
  Coins,
  MessageSquare,
  Phone,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { AdminHeader, AdminShell } from "@/components/admin/admin-header";
import { AreaChart } from "@/components/charts";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  SkeletonChart,
} from "@/components/ui";

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

/**
 * Admin · platform analytics (§ admin surface).
 *
 * Daily actives get the same `<AreaChart>` used on the learner dashboard
 * (animated draw-in, hover crosshair, keyboard scrubbing) instead of a bar
 * list, so the operator sees a trend rather than a ranked list. Revenue tiles
 * state plainly when Stripe is unconfigured rather than rendering a dash that
 * looks like missing data.
 */
export default function AdminAnalyticsPage() {
  const { getToken, isLoaded } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<PlatformStats>("/admin/analytics?days=14", {
        token: await getToken(),
      });
      setStats(result);
      setFailed(null);
    } catch (e) {
      setFailed(
        e instanceof ApiError && e.status === 403
          ? "Admin role required."
          : e instanceof Error
            ? `Could not load analytics: ${e.message}`
            : "Load failed.",
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [isLoaded, load]);

  const totals = stats?.totals;
  const revenue = stats?.revenue;

  const tiles = [
    {
      eyebrow: "Attempts",
      icon: <Activity className="h-4 w-4" />,
      value: totals ? <AnimatedNumber value={totals.attempts} /> : <Skeleton className="h-6 w-20" />,
      hint: `Answered in the last ${stats?.days ?? 14} days`,
    },
    {
      eyebrow: "New users",
      icon: <Users className="h-4 w-4" />,
      value: totals ? <AnimatedNumber value={totals.newUsers} /> : <Skeleton className="h-6 w-16" />,
      hint: "Sign-ups in window",
    },
    {
      eyebrow: "AI queries",
      icon: <MessageSquare className="h-4 w-4" />,
      value: totals ? <AnimatedNumber value={totals.aiQueries} /> : <Skeleton className="h-6 w-16" />,
      hint: totals?.aiHitRate != null ? `${Math.round(totals.aiHitRate * 100)}% served from cache` : "Cache ratio unavailable",
    },
    {
      eyebrow: "Videos ready",
      icon: <Video className="h-4 w-4" />,
      value: totals ? <AnimatedNumber value={totals.videosReady} /> : <Skeleton className="h-6 w-16" />,
      hint: "Rendered explainers",
    },
    {
      eyebrow: "Call minutes",
      icon: <Phone className="h-4 w-4" />,
      value: totals ? <AnimatedNumber value={totals.callMinutes} /> : <Skeleton className="h-6 w-16" />,
      hint: "Talk time in window",
    },
    {
      eyebrow: "MRR",
      icon: <Coins className="h-4 w-4" />,
      value: revenue?.configured ? (
        revenue.mrrUsd == null ? (
          <span className="text-base font-medium font-mono text-fg-muted">Stripe error</span>
        ) : (
          <AnimatedNumber value={revenue.mrrUsd} prefix="$" />
        )
      ) : (
        <span className="text-base font-medium text-fg-muted">Stripe off</span>
      ),
      hint: revenue?.configured ? "Normalised monthly" : "No Stripe key configured",
    },
    {
      eyebrow: "Active subs",
      icon: <BarChart3 className="h-4 w-4" />,
      value:
        revenue?.activeSubs == null ? (
          <span className="text-base font-medium text-fg-muted">—</span>
        ) : (
          <AnimatedNumber value={revenue.activeSubs} />
        ),
      hint: revenue?.configured ? "Currently subscribed" : "Requires Stripe",
    },
    {
      eyebrow: "Window",
      icon: <Activity className="h-4 w-4" />,
      value: stats ? <AnimatedNumber value={stats.days} suffix="d" /> : <Skeleton className="h-6 w-12" />,
      hint: "Reporting period",
    },
  ];

  const dauPoints = (stats?.perDay ?? []).map((point) => ({ day: point.day, value: point.dau }));
  const attemptPoints = (stats?.perDay ?? []).map((point) => ({ day: point.day, value: point.attempts }));

  return (
    <AdminShell>
      <AdminHeader
        title="Platform"
        description="Usage and revenue telemetry across the reporting window. Figures are read live from the admin analytics endpoint."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />

      {failed && (
        <div className="mt-6 flex items-center gap-2 rounded-card border border-line-strong bg-surface-2 px-4 py-3 text-xs text-fg">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
          {failed}
        </div>
      )}

      {/* KPI grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.eyebrow} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                {tile.eyebrow}
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-fg-muted">
                {tile.icon}
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {tile.value}
            </div>
            <div className="mt-1 text-xs text-fg-muted">{tile.hint}</div>
          </Card>
        ))}
      </div>

      {/* Daily actives */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Daily active users</CardTitle>
            <CardDescription>
              Distinct engineers with at least one attempt. Hover or focus the chart and use ←/→ to inspect a day.
            </CardDescription>
          </div>
          {stats && (
            <Badge variant="iris" size="sm">
              {stats.days}d window
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!stats && !failed && <SkeletonChart className="h-[200px]" />}

          {stats && dauPoints.length > 0 && (
            <AreaChart points={dauPoints} label="Daily active users" height={200} valueSuffix=" users" />
          )}

          {stats && dauPoints.length === 0 && (
            <EmptyState
              compact
              icon={<Users className="h-5 w-5" />}
              title="No activity in this window"
              description="Daily actives appear once engineers start attempting questions."
            />
          )}
        </CardContent>
      </Card>

      {/* Attempts */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Attempts per day</CardTitle>
            <CardDescription>Grading volume, which drives the generation budget.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!stats && !failed && <SkeletonChart className="h-[180px]" />}

          {stats && attemptPoints.length > 0 && (
            <AreaChart
              points={attemptPoints}
              label="Attempts per day"
              height={180}
              valueSuffix=" attempts"
            />
          )}

          {stats && attemptPoints.length === 0 && (
            <p className="py-6 text-center font-mono text-xs text-fg-dim">
              No attempts recorded in this window.
            </p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
