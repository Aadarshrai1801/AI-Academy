"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { buildBreadcrumb } from "@/components/shell/nav-items";
import { QuotaPill } from "@/components/shell/quota-pill";
import { StreakBadge } from "@/components/shell/streak-badge";
import { UserMenu } from "@/components/shell/user-menu";
import { IconButton, Skeleton, ThemeToggle } from "@/components/ui";
import type { TelemetryState } from "@/lib/telemetry";

/**
 * Workbench top bar (§2.8): breadcrumb, streak, quota.
 *
 * Scroll-aware glass is handled with a CSS `backdrop-blur` on the sticky
 * header rather than a scroll listener: one less main-thread subscriber, and
 * the effect is identical.
 *
 * Signed out, the telemetry cluster becomes a sign-in invitation — public
 * routes like /leaderboard render this bar, so "skeleton forever" is not an
 * acceptable terminal state.
 */
export function Topbar({
  telemetry,
  onOpenDrawer,
}: {
  telemetry: TelemetryState;
  onOpenDrawer: () => void;
}) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const crumbs = buildBreadcrumb(pathname);

  return (
    <header className="glass-panel sticky top-0 z-30 flex h-14 w-full items-center justify-between gap-3 border-b border-line px-3 sm:px-5">
      {/* Left: mobile nav trigger + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <IconButton label="Open navigation" onClick={onOpenDrawer} className="md:hidden">
          <Menu className="h-4 w-4" />
        </IconButton>

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <span className="text-fg-dim">/</span>}
                  {isLast || !crumb.href ? (
                    <span
                      className={
                        isLast
                          ? "truncate font-medium text-fg"
                          : "truncate text-fg-muted"
                      }
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="truncate text-fg-muted transition-colors hover:text-fg">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Right: telemetry cluster (three states) + account */}
      <div className="flex shrink-0 items-center gap-2">
        {!isLoaded ? (
          <Skeleton className="h-8 w-32 rounded-full" />
        ) : isSignedIn ? (
          <>
            <StreakBadge summary={telemetry.summary} />
            <QuotaPill quota={telemetry.quota} />
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href="/sign-in"
              className="rounded-btn px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-btn border border-transparent bg-fg px-3 py-1.5 text-xs font-semibold text-surface-0 shadow-sm transition-all hover:opacity-90"
            >
              Create account
            </Link>
          </div>
        )}
        <ThemeToggle />
        <div className="md:hidden">
          <UserMenu variant="compact" />
        </div>
      </div>
    </header>
  );
}
