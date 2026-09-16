"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge, ProgressBar, Skeleton, quotaTone } from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { TelemetryState } from "@/lib/telemetry";

/**
 * Desktop workbench rail (§2.8).
 *
 * The active item is marked by a single shared-layout element (`layoutId`), so
 * navigating slides one pill between items instead of cross-fading two static
 * borders — the "Linear sidebar" pattern. Framer Motion's layout animation
 * owns the travel, which is why the pill keeps its identity across renders.
 *
 * Telemetry has three designed states: unresolved (skeleton), signed out
 * (invitation to sign in), and signed in (quota + streak + today). A public
 * route such as /leaderboard is reachable while signed out, so the rail must
 * never sit on a loading skeleton forever.
 */
export function Sidebar({ telemetry }: { telemetry: TelemetryState }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const reduced = useReducedMotion();

  const { summary, quota } = telemetry;
  const role = summary?.role;
  const isPro = role === "pro" || role === "admin";
  const currentStreak = summary?.streak.current ?? 0;
  const todayAttempts = summary?.today.attempts ?? 0;
  const accuracy = summary?.today.accuracy;

  const quotaExhausted = isSignedIn && !isPro && quota !== null && quota.remaining <= 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 select-none flex-col border-r border-line bg-surface-1 md:flex">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/40 bg-brand-soft font-mono text-xs font-bold text-brand transition-transform group-hover:scale-105">
            {"//"}
          </span>
          <span className="truncate text-sm font-bold tracking-tight text-fg">AI Academy</span>
        </Link>
        {isPro && <Badge variant="iris" size="sm" className="ml-auto">Pro</Badge>}
      </div>

      {/* Navigation */}
      <nav aria-label="Workbench" className="flex-1 overflow-y-auto px-2.5 py-4">
        <p className="px-2.5 pb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
          Workbench
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {/* Sliding active pill — one element, shared across items. */}
                  {active && (
                    <motion.span
                      layoutId="rail-active-pill"
                      transition={reduced ? { duration: 0 } : SPRING.layout}
                      className="absolute inset-0 rounded-lg border border-line-strong bg-surface-3"
                      aria-hidden="true"
                    >
                      <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand" />
                    </motion.span>
                  )}

                  <motion.span
                    className={cn("relative z-10 shrink-0", active ? "text-brand" : "text-fg-dim")}
                    whileHover={reduced ? undefined : { scale: 1.12 }}
                    animate={reduced ? undefined : { scale: active ? 1.06 : 1 }}
                    transition={SPRING.snappy}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </motion.span>

                  <span className="relative z-10 truncate font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Telemetry: skeleton → signed-out → signed-in */}
      <div className="shrink-0 border-t border-line px-2.5 py-3">
        {!isLoaded ? (
          <div className="rounded-card border border-line bg-surface-2 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-1.5 w-full" />
            <Skeleton className="mt-3 h-3 w-28" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ) : !isSignedIn ? (
          <div className="rounded-card border border-line bg-surface-2 p-3">
            <p className="text-[11px] leading-relaxed text-fg-muted">
              Sign in to track your streak, daily quota, and rank.
            </p>
            <Link
              href="/sign-in"
              className="mt-2.5 block rounded-btn border border-line-strong bg-surface-3 px-3 py-1.5 text-center font-mono text-[11px] font-medium text-fg transition-colors hover:border-[var(--brand-ring)] hover:bg-surface-4"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            {quotaExhausted && (
              <div className="mb-2.5 rounded-card border border-brand/40 bg-brand-soft p-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
                  Daily limit reached
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
                  Free tier refills at 00:00 UTC. Pro raises this to 500 questions a day.
                </p>
                <Link
                  href="/pricing"
                  className="mt-2.5 block rounded-btn bg-brand px-3 py-1.5 text-center font-mono text-[11px] font-semibold text-on-brand transition-opacity hover:opacity-90"
                >
                  Compare plans
                </Link>
              </div>
            )}

            <div className="rounded-card border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                  Daily quota
                </span>
                {quota ? (
                  <span className="font-mono text-[11px] font-medium tabular-nums text-fg">
                    {quota.limit === -1 ? "∞" : `${quota.remaining}/${quota.limit}`}
                  </span>
                ) : (
                  <Skeleton className="h-3 w-10" />
                )}
              </div>

              <div className="mt-2">
                {quota && quota.limit > 0 ? (
                  <ProgressBar
                    value={quota.remaining}
                    max={quota.limit}
                    tone={quotaTone(quota.remaining, quota.limit)}
                    label="Questions left today"
                  />
                ) : (
                  <Skeleton className="h-1.5 w-full" />
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-fg-muted">Today</span>
                <span className="font-mono tabular-nums text-fg">
                  {todayAttempts} attempt{todayAttempts === 1 ? "" : "s"}
                  {accuracy !== null && accuracy !== undefined && (
                    <span className="text-fg-dim"> · {Math.round(accuracy * 100)}%</span>
                  )}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-fg-muted">Streak</span>
                <span className="flex items-center gap-1 font-mono font-medium tabular-nums text-brand">
                  <Flame className="h-3 w-3" aria-hidden="true" />
                  {currentStreak}d
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Account */}
      <div className="shrink-0 border-t border-line p-2.5">
        <UserMenu variant="rail" />
      </div>
    </aside>
  );
}
