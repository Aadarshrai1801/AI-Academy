"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { CircleAlert, Coins, Cpu, Database, RefreshCw, Server } from "lucide-react";
import { ApiError, TOPICS, apiFetch, type GenStatusDTO } from "@/lib/api";
import { AdminHeader, AdminShell } from "@/components/admin/admin-header";
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
  ProgressBar,
  Skeleton,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const DIFFS = ["easy", "medium", "hard"] as const;

/**
 * Admin · question bank (§ admin surface).
 *
 * The old table showed raw ratios (`12/400`) for 18 topic×difficulty combos,
 * which meant reading every cell to find the problem. Each cell is now a
 * depleting bar against the buffer target, so a starved combination is visible
 * at a glance and the numbers are there for whoever wants them.
 */
export default function AdminPage() {
  const { getToken, isLoaded } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [status, setStatus] = useState<GenStatusDTO | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<"ensure" | "clean" | "drain" | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<GenStatusDTO>("/admin/generation/status", {
        token: await getToken(),
      });
      setStatus(next);
      setFailed(null);
    } catch (e) {
      setFailed(
        e instanceof ApiError && e.status === 403
          ? "Admin role required — promote your user first (see README)."
          : e instanceof Error
            ? `Could not load status: ${e.message}`
            : "Could not load status.",
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [isLoaded, load]);

  async function run(action: "ensure" | "clean" | "drain") {
    setBusy(action);
    try {
      if (action === "ensure") {
        const result = await apiFetch<{ enqueued: unknown[] }>("/admin/generation/ensure", {
          method: "POST",
          token: await getToken(),
          body: {},
        });
        toast({
          title: `Enqueued ${result.enqueued.length} top-up job(s)`,
          description: "Buffers refill in the background.",
          variant: "success",
        });
      } else if (action === "clean") {
        await apiFetch("/admin/generation/clean-failed", { method: "POST", token: await getToken() });
        toast({ title: "Cleared failed jobs", variant: "success" });
      } else {
        await apiFetch("/admin/generation/drain-waiting", { method: "POST", token: await getToken() });
        toast({
          title: "Drained waiting jobs",
          description: "Press top up for the full target.",
          variant: "info",
        });
      }
      await load();
    } catch (e) {
      toast({
        title: "Action failed",
        description:
          e instanceof ApiError && e.status === 503
            ? "Generation queue offline — check REDIS_URL and restart the API. The bank still serves seeded questions."
            : e instanceof ApiError && e.status === 429
              ? "Daily budget spent — resets 00:00 UTC."
              : e instanceof Error
                ? e.message
                : "Unknown error.",
        variant: "error",
        duration: 6000,
      });
    } finally {
      setBusy(null);
    }
  }

  const jobs = status?.jobs;
  const failedJobs = jobs?.failed ?? 0;
  const waitingJobs = jobs?.waiting ?? 0;

  return (
    <AdminShell>
      <AdminHeader
        title="Question bank"
        description={`Buffer health and backfill control on ${status?.provider ?? "the configured provider"}. Cells below compare approved questions against the per-combination target.`}
      />

      {failed && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-strong bg-surface-2 px-4 py-3 text-xs text-fg">
          <span className="flex items-center gap-2">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
            {failed}
          </span>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            eyebrow: "Provider",
            icon: <Server className="h-4 w-4" />,
            value: status ? <span className="text-base font-semibold">{status.provider}</span> : <Skeleton className="h-6 w-20" />,
            hint: "Active generation backend",
          },
          {
            eyebrow: "Buffer target",
            icon: <Database className="h-4 w-4" />,
            value: status ? <AnimatedNumber value={status.target} suffix=" / combo" /> : <Skeleton className="h-6 w-24" />,
            hint: "Approved questions per topic × difficulty",
          },
          {
            eyebrow: "Budget today",
            icon: <Coins className="h-4 w-4" />,
            value: status ? <AnimatedNumber value={status.budget.used} /> : <Skeleton className="h-6 w-20" />,
            hint: status ? `of ${status.budget.daily} generations` : "Daily spend",
          },
          {
            eyebrow: "Queue",
            icon: <Cpu className="h-4 w-4" />,
            value: jobs ? (
              <span className="text-base font-semibold tabular-nums">
                {waitingJobs} / {jobs.active ?? 0} / <span className={cn(failedJobs > 0 && "text-fg font-semibold underline decoration-dashed")}>{failedJobs}</span>
              </span>
            ) : (
              <span className="text-base font-medium text-fg-muted">n/a</span>
            ),
            hint: "Waiting / active / failed",
          },
        ].map((tile, index) => (
          <Card key={tile.eyebrow} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                {tile.eyebrow}
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-fg-muted">
                {tile.icon}
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg">{tile.value}</div>
            <div className="mt-1 text-xs text-fg-muted">{tile.hint}</div>
            {index === 2 && status && status.budget.daily > 0 && (
              <ProgressBar
                className="mt-3"
                value={status.budget.used}
                max={status.budget.daily}
                tone={status.budget.used / status.budget.daily > 0.85 ? "warning" : "brand"}
                label="Generation budget used today"
              />
            )}
          </Card>
        ))}
      </div>

      {/* Actions */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Backfill actions</CardTitle>
            <CardDescription>
              Top-up jobs are idempotent — pressing twice does not duplicate work.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button loading={busy === "ensure"} disabled={busy !== null} onClick={() => void run("ensure")}>
            {busy === "ensure" ? "Enqueuing" : "Top up all buffers"}
          </Button>
          {failedJobs > 0 && (
            <Button
              variant="secondary"
              loading={busy === "clean"}
              disabled={busy !== null}
              onClick={() => void run("clean")}
            >
              Clear {failedJobs} failed
            </Button>
          )}
          {waitingJobs > 0 && (
            <Button
              variant="ghost"
              loading={busy === "drain"}
              disabled={busy !== null}
              onClick={() => void run("drain")}
            >
              Drain {waitingJobs} waiting
            </Button>
          )}
          {!status && <Skeleton className="h-10 w-48" />}
        </CardContent>
      </Card>

      {/* Bank matrix */}
      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Bank coverage</CardTitle>
            <CardDescription>
              Amber means approved is below target — those combinations will fall back to seeding.
            </CardDescription>
          </div>
          {status && (
            <Badge variant={failedJobs > 0 ? "outline" : "solid"} size="sm" dot={failedJobs === 0}>
              {failedJobs > 0 ? `${failedJobs} failed jobs` : "Pipeline healthy"}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {!status && (
            <div className="flex flex-col gap-3 px-5">
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-9 w-full" />
              ))}
            </div>
          )}

          {status && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-1">
                    <th className="px-5 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                      Topic
                    </th>
                    {DIFFS.map((diff) => (
                      <th
                        key={diff}
                        className="px-5 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim"
                      >
                        {diff}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOPICS.map((topic, rowIndex) => (
                    <tr key={topic} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-fg-muted">{topic}</td>
                      {DIFFS.map((diff, colIndex) => {
                        const cell = status.bank[topic]?.[diff] ?? { approved: 0, pending: 0 };
                        const starved = cell.approved < status.target;
                        return (
                          <td key={diff} className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <motion.span
                                className="min-w-[3.5rem] font-mono text-xs tabular-nums"
                                initial={reduced ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: (rowIndex * 3 + colIndex) * 0.012 }}
                              >
                                <span className={cn("font-semibold", starved ? "text-fg-muted" : "text-fg")}>
                                  {cell.approved}
                                </span>
                                <span className="text-fg-dim">/{status.target}</span>
                              </motion.span>
                              <ProgressBar
                                value={cell.approved}
                                max={Math.max(status.target, 1)}
                                tone={starved ? "warning" : "success"}
                                className="max-w-[7rem]"
                                label={`${topic} ${diff}: ${cell.approved} of ${status.target} approved`}
                              />
                              {cell.pending > 0 && (
                                <span className="font-mono text-[10px] text-fg-dim">+{cell.pending}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {status && status.bank && Object.keys(status.bank).length === 0 && (
            <EmptyState
              compact
              icon={<Database className="h-5 w-5" />}
              title="Bank is empty"
              description="Run a top-up to seed the first questions for each topic and difficulty."
            />
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
