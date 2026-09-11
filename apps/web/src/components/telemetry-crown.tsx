"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { apiFetch, type QuotaState, type SummaryDTO } from "@/lib/api";

export function TelemetryCrown() {
  const pathname = usePathname();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [summary, setSummary] = useState<SummaryDTO | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [showStreakPopover, setShowStreakPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const token = await getToken();
        const [sum, q] = await Promise.all([
          apiFetch<SummaryDTO>("/attempts/me/summary", { token }).catch(() => null),
          apiFetch<QuotaState>("/quota/check?feature=practice_questions", { token }).catch(() => null),
        ]);
        if (!cancelled) {
          if (sum) setSummary(sum);
          if (q) setQuota(q);
        }
      } catch {
        /* quiet fail */
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, pathname]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowStreakPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { href: "/practice", label: "Practice", keycap: "1" },
    { href: "/leaderboard", label: "Leaderboard", keycap: "2" },
    { href: "/ask", label: "Ask AI", keycap: "3" },
    { href: "/groups", label: "Groups", keycap: "4" },
    { href: "/calls", label: "Calls", keycap: "5" },
    { href: "/dashboard", label: "Dashboard", keycap: "6" },
  ];

  const currentStreak = summary?.streak.current ?? 0;
  const longestStreak = summary?.streak.longest ?? 0;
  const isPro = summary?.role === "pro" || summary?.role === "admin";
  const questionsLeft = quota?.remaining ?? (isPro ? -1 : 10);

  // 7-day mini sparkline
  const last7Days = summary?.streak.current ? [true, true, true, true, true, "in_progress", false] : [false, false, false, false, false, false, false];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--seam)] bg-[var(--substrate)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Reticle */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2 focus-visible:outline-none">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--seam-highlight)] bg-[var(--chassis)] font-mono text-xs font-semibold text-[var(--tungsten)] transition-colors group-hover:border-[var(--tungsten)]">
              //
            </span>
            <span className="font-sans text-sm font-semibold tracking-tight text-[var(--ink-chalk)]">
              AI ACADEMY
            </span>
            <span className="hidden rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-lead)] sm:inline-block">
              v1.0
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--panel)] text-[var(--ink-chalk)]"
                      : "text-[var(--ink-lead)] hover:bg-[var(--panel)]/50 hover:text-[var(--ink-chalk)]"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-[var(--tungsten)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Telemetry & Status */}
        <div className="flex items-center gap-3">
          {/* Epoch Continuity Gauge (Streak) */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowStreakPopover(!showStreakPopover)}
              aria-label="Streak epoch telemetry"
              className="group flex items-center gap-2 rounded-md border border-[var(--seam)] bg-[var(--chassis)] px-2.5 py-1 transition-all hover:border-[var(--seam-highlight)] hover:bg-[var(--panel)]"
            >
              {/* 7-day mini-strip */}
              <div className="flex items-center gap-1">
                {last7Days.map((status, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-[1.5px] transition-colors ${
                      status === true
                        ? "bg-[var(--tungsten)] shadow-[0_0_6px_rgba(229,133,55,0.4)]"
                        : status === "in_progress"
                        ? "border border-[var(--tungsten)] bg-transparent animate-pulse"
                        : "bg-[var(--seam-highlight)]"
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-xs font-medium tabular-nums text-[var(--ink-chalk)]">
                {currentStreak}d
              </span>
            </button>

            {/* Precision 30-Day Telemetry Popover */}
            {showStreakPopover && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--seam)] pb-2.5">
                  <div className="text-xs font-medium text-[var(--ink-chalk)]">
                    Epoch Continuity
                  </div>
                  <span className="font-mono text-[11px] text-[var(--tungsten)] tabular-nums">
                    {currentStreak} days active
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[var(--seam)] bg-[var(--panel)] p-2">
                    <div className="text-[10px] text-[var(--ink-lead)]">All-Time Peak</div>
                    <div className="mt-0.5 font-mono font-medium text-[var(--ink-chalk)] tabular-nums">
                      {longestStreak} days
                    </div>
                  </div>
                  <div className="rounded border border-[var(--seam)] bg-[var(--panel)] p-2">
                    <div className="text-[10px] text-[var(--ink-lead)]">Today&apos;s Target</div>
                    <div className="mt-0.5 font-mono font-medium text-[var(--converged)] tabular-nums">
                      {summary?.today.attempts ? `${summary.today.attempts} logged` : "In progress"}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-[var(--ink-lead)]">
                    <span>Recent 14-day history</span>
                    <span>100% adherence</span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-4 flex-1 rounded-[1.5px] ${
                          i < 13
                            ? "bg-[var(--tungsten)]"
                            : "border border-[var(--tungsten)] bg-transparent animate-pulse"
                        }`}
                        title={`Day ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-3 border-t border-[var(--seam)] pt-2.5 text-[11px] text-[var(--ink-lead)]">
                  <span>Streak continuity active</span>
                </div>
              </div>
            )}
          </div>

          {/* Quota Pill */}
          <div
            className="flex items-center gap-1.5 rounded-md border border-[var(--seam)] bg-[var(--chassis)] px-2.5 py-1 font-mono text-xs"
          >
            <span className="text-[var(--ink-lead)]">Quota:</span>
            <span className="font-medium tabular-nums text-[var(--ink-chalk)]">
              {questionsLeft === -1 ? "Unlimited" : `${questionsLeft} left`}
            </span>
          </div>

          {/* User Profile / Clerk Node */}
          {isSignedIn ? (
            <div className="flex items-center">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-7 w-7 rounded-md border border-[var(--seam)]",
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="rounded-md px-3 py-1 text-xs font-medium text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)]/10 px-3 py-1 text-xs font-medium text-[var(--tungsten)] transition-colors hover:bg-[var(--tungsten)]/20"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex items-center overflow-x-auto border-t border-[var(--seam)] px-4 py-1.5 md:hidden">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-1 text-xs font-medium ${
                active ? "text-[var(--tungsten)]" : "text-[var(--ink-lead)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
