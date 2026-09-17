"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge, LogoMark, ProgressBar, ProgressRing, Skeleton, quotaTone } from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { TelemetryState } from "@/lib/telemetry";

/**
 * Desktop workbench rail (§2.8).
 *
 * Modern SaaS workbench design with Aceternity-grade collapsible rail:
 * - Expands to w-60 (full labels, telemetry cards)
 * - Collapses to w-16 (icon-only mode with tooltips, compact telemetry)
 * - Active item marked with shared-layout element (layoutId) + indigo pip
 */
export function Sidebar({
  telemetry,
  collapsed = false,
  onToggleCollapse,
}: {
  telemetry: TelemetryState;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
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
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden select-none flex-col border-r border-line bg-surface-1 transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line px-3",
          collapsed ? "justify-center" : "justify-between gap-2 px-4",
        )}
      >
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5"
          title="AI Academy"
        >
          <LogoMark
            size={28}
            className="shadow-xs transition-transform group-hover:scale-105"
          />
          {!collapsed && (
            <span className="truncate text-sm font-bold tracking-tight text-fg">AI Academy</span>
          )}
        </Link>
        {!collapsed && isPro && (
          <Badge variant="solid" size="sm" className="ml-auto">
            Pro
          </Badge>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg",
              collapsed && "hidden",
            )}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Workbench" className="flex-1 overflow-y-auto px-2 py-4">
        {!collapsed && (
          <p className="px-2.5 pb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Workbench
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg text-sm transition-colors",
                    collapsed
                      ? "h-10 w-full justify-center px-0"
                      : "gap-3 px-2.5 py-2",
                    active ? "text-brand-ink font-medium" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {/* Sliding active pill — one element, shared across items. */}
                  {active && (
                    <motion.span
                      layoutId="rail-active-pill"
                      transition={reduced ? { duration: 0 } : SPRING.layout}
                      className={cn(
                        "absolute inset-0 rounded-lg border border-brand/20 bg-brand-soft shadow-glow",
                      )}
                      aria-hidden="true"
                    >
                      {!collapsed && (
                        <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand" />
                      )}
                    </motion.span>
                  )}

                  <motion.span
                    className={cn(
                      "relative z-10 shrink-0",
                      active ? "text-brand-ink" : "text-fg-dim group-hover:text-fg",
                    )}
                    whileHover={reduced ? undefined : { scale: 1.12 }}
                    animate={reduced ? undefined : { scale: active ? 1.06 : 1 }}
                    transition={SPRING.snappy}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </motion.span>

                  {!collapsed && (
                    <span className="relative z-10 truncate font-medium">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse button for collapsed mode */}
      {onToggleCollapse && collapsed && (
        <div className="flex shrink-0 justify-center border-t border-line py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="rounded-md p-2 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Telemetry: skeleton → signed-out → signed-in */}
      <div className={cn("shrink-0 border-t border-line", collapsed ? "px-2 py-3" : "px-2.5 py-3")}>
        {!isLoaded ? (
          collapsed ? (
            <Skeleton className="mx-auto h-8 w-8 rounded-lg" />
          ) : (
            <div className="rounded-card border border-line bg-surface-2 p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-1.5 w-full" />
              <Skeleton className="mt-3 h-3 w-28" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          )
        ) : !isSignedIn ? (
          collapsed ? (
            <Link
              href="/sign-in"
              title="Sign in"
              className="grid h-9 w-full place-items-center rounded-btn border border-line-strong bg-surface-3 text-fg transition-colors hover:border-line-strong hover:bg-surface-4 hover:shadow-glow"
            >
              <LogoMark size={18} title={null} />
            </Link>
          ) : (
            <div className="rounded-card border border-line bg-surface-2 p-3">
              <p className="text-[11px] leading-relaxed text-fg-muted">
                Sign in to track your streak, daily quota, and rank.
              </p>
              <Link
                href="/sign-in"
                className="mt-2.5 block rounded-btn border border-line-strong bg-surface-3 px-3 py-1.5 text-center font-mono text-[11px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-4 hover:shadow-glow"
              >
                Sign in
              </Link>
            </div>
          )
        ) : collapsed ? (
          /* Compact telemetry icon stack */
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex flex-col items-center gap-0.5 rounded-lg p-1 text-center"
              title={`Streak: ${currentStreak} days`}
            >
              <Flame className="h-4 w-4 text-warning fill-warning/20" />
              <span className="font-mono text-[10px] font-medium tabular-nums text-fg">
                {currentStreak}d
              </span>
            </div>
            {quota && quota.limit > 0 && (
              <div
                className="flex items-center justify-center"
                title={`Quota: ${quota.remaining}/${quota.limit}`}
              >
                <ProgressRing
                  value={quota.remaining}
                  max={quota.limit}
                  size={26}
                  strokeWidth={3}
                  tone={quotaTone(quota.remaining, quota.limit)}
                />
              </div>
            )}
          </div>
        ) : (
          /* Full telemetry cards */
          <>
            {quotaExhausted && (
              <div className="mb-2.5 rounded-card border border-error/40 bg-state-negative-soft p-3 shadow-glow">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-state-negative-ink">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" aria-hidden="true" />
                  Daily limit reached
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
                  Free tier refills at 00:00 UTC. Pro raises this to 500 questions a day.
                </p>
                <Link
                  href="/pricing"
                  className="mt-2.5 block rounded-btn bg-brand px-3 py-1.5 text-center font-mono text-[11px] font-semibold text-on-brand shadow-sm transition-all hover:bg-brand-strong"
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
                <span className="flex items-center gap-1 font-mono font-medium tabular-nums text-fg">
                  <Flame className="h-3 w-3 text-warning fill-warning/20" aria-hidden="true" />
                  {currentStreak}d
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Account */}
      <div className={cn("shrink-0 border-t border-line", collapsed ? "p-1.5" : "p-2.5")}>
        <UserMenu variant={collapsed ? "icon" : "rail"} />
      </div>
    </aside>
  );
}
