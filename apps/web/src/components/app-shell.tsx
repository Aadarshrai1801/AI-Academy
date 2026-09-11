"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { apiFetch, type QuotaState, type SummaryDTO } from "@/lib/api";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [summary, setSummary] = useState<SummaryDTO | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaExpiredEvent, setQuotaExpiredEvent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isLanding = pathname === "/";

  // Listen for real-time quota expiration events from workbench
  useEffect(() => {
    function handleQuotaExpired() {
      setQuotaExpiredEvent(true);
    }
    window.addEventListener("ai-academy:quota-expired", handleQuotaExpired);
    return () => window.removeEventListener("ai-academy:quota-expired", handleQuotaExpired);
  }, []);

  // Fetch telemetry only when user is signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setSummary(null);
      setQuota(null);
      return;
    }

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    {
      href: "/practice",
      label: "Practice",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      href: "/ask",
      label: "AI Tutor",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      href: "/groups",
      label: "Study Groups",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/calls",
      label: "Live Calls",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
  ];

  const isPro = summary?.role === "pro" || summary?.role === "admin";
  const currentStreak = summary?.streak.current ?? 0;
  const questionsLeft = quota?.remaining ?? (isPro ? -1 : 10);
  const isLimitExpired = !isPro && (quotaExpiredEvent || questionsLeft <= 0 || (quota !== null && quota.remaining <= 0));

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 1: LANDING PAGE MODE (Top SaaS Marketing Navbar)
  // ──────────────────────────────────────────────────────────────────────────
  if (isLanding) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--substrate)] text-[var(--ink-chalk)] font-sans selection:bg-[var(--tungsten)]/30">
        <header className="sticky top-0 z-50 w-full border-b border-[var(--seam)] bg-[var(--substrate)]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
            {/* Brand Logo */}
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 font-mono text-xs font-bold text-[var(--tungsten)] shadow-[0_0_10px_rgba(229,133,55,0.2)] transition-transform group-hover:scale-105">
                //
              </span>
              <span className="font-sans text-base font-bold tracking-tight text-[var(--ink-chalk)]">
                AI ACADEMY
              </span>
              <span className="hidden rounded bg-[var(--panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--tungsten)] sm:inline-block border border-[var(--seam)]">
                AI Workbench
              </span>
            </Link>

            {/* Middle Nav Links */}
            <nav className="hidden items-center gap-6 md:flex text-xs font-medium text-[var(--ink-lead)]">
              <a href="#features" className="transition-colors hover:text-[var(--ink-chalk)]">
                Features
              </a>
              <Link href="/pricing" className="transition-colors hover:text-[var(--ink-chalk)]">
                Pricing
              </Link>
            </nav>

            {/* Auth Actions on Right */}
            <div className="flex items-center gap-3">
              {isSignedIn ? (
                <>
                  <Link
                    href="/practice"
                    className="hidden sm:flex items-center rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 shadow-[0_0_12px_rgba(229,133,55,0.25)]"
                  >
                    <span>Launch Workbench</span>
                  </Link>
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "h-8 w-8 rounded-md border border-[var(--seam-highlight)]",
                      },
                    }}
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="rounded-md px-3.5 py-1.5 text-xs font-medium text-[var(--ink-lead)] transition-colors hover:text-[var(--ink-chalk)]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/sign-up"
                    className="flex items-center rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 shadow-[0_0_12px_rgba(229,133,55,0.25)]"
                  >
                    <span>Sign Up</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-[var(--seam)] bg-[var(--substrate)] px-6 py-8 text-xs text-[var(--ink-lead)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[var(--tungsten)]">//</span>
              <span>AI ACADEMY — High-Performance Learning Engine for AI & Machine Learning Engineers</span>
            </div>
            <div className="flex items-center gap-5 text-xs">
              <a href="#features" className="hover:text-[var(--ink-chalk)]">Features</a>
              <Link href="/pricing" className="hover:text-[var(--ink-chalk)]">Pricing</Link>
              <Link href="/sign-in" className="hover:text-[var(--ink-chalk)]">Sign In</Link>
              <Link href="/sign-up" className="hover:text-[var(--ink-chalk)]">Sign Up</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 2: APP / WORKBENCH MODE (Left Activity Bar Sidebar Layout)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[var(--substrate)] text-[var(--ink-chalk)] font-sans">
      {/* Desktop Left Activity Bar (Sidebar) */}
      <aside className="hidden md:flex md:w-60 md:flex-col fixed inset-y-0 left-0 z-40 border-r border-[var(--seam)] bg-[var(--chassis)] select-none">
        {/* Sidebar Header Brand */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--seam)] px-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 font-mono text-xs font-semibold text-[var(--tungsten)] transition-transform group-hover:scale-105">
              //
            </span>
            <span className="font-sans text-sm font-bold tracking-tight text-[var(--ink-chalk)]">
              AI ACADEMY
            </span>
            <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--ink-lead)]">
              PRO
            </span>
          </Link>
        </div>

        {/* Navigation Items (Activity Bar) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-2 mb-2 font-mono text-[10px] uppercase text-[var(--ink-dim)] tracking-wider">
            Workbench Rail
          </div>
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-[var(--panel)] text-[var(--ink-chalk)] border-l-2 border-[var(--tungsten)] shadow-sm font-semibold"
                    : "text-[var(--ink-lead)] hover:bg-[var(--panel)]/50 hover:text-[var(--ink-chalk)]"
                }`}
              >
                <span
                  className={`transition-colors ${
                    active ? "text-[var(--tungsten)]" : "text-[var(--ink-dim)] group-hover:text-[var(--ink-lead)]"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Telemetry Indicator (only shown if signed in) */}
        {isSignedIn && (
          <div className="border-t border-[var(--seam)] p-3 bg-[var(--substrate)]/60">
            <div className="rounded-md border border-[var(--seam)] bg-[var(--panel)] p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[var(--ink-lead)]">Daily Quota</span>
                <span className="font-mono font-medium text-[var(--ink-chalk)] tabular-nums">
                  {questionsLeft === -1 ? "Unlimited" : `${questionsLeft} left`}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="font-mono text-[var(--ink-lead)]">Streak</span>
                <span className="flex items-center gap-1 font-mono font-medium text-[var(--tungsten)] tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--tungsten)] animate-pulse" />
                  {currentStreak > 0 ? `${currentStreak}d` : "Active"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Profile / Account Node */}
        <div className="border-t border-[var(--seam)] p-3 bg-[var(--chassis)]">
          {isSignedIn ? (
            <div className="flex flex-col gap-2.5">
              {/* Instructions to Upgrade Plan when Limits Expire */}
              {isLimitExpired && (
                <div className="rounded-lg border border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 p-3 shadow-lg shadow-black/20 animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--tungsten)] uppercase tracking-wider">
                    <span className="h-2 w-2 rounded-full bg-[var(--tungsten)] animate-pulse" />
                    <span>DAILY LIMIT EXPIRED</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-chalk)]">
                    You have reached your free tier daily limit. Follow these steps to upgrade your plan:
                  </p>
                  <div className="mt-2 space-y-1.5 border-t border-[var(--tungsten)]/20 pt-2 font-mono text-[10px] text-[var(--ink-lead)]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-[var(--tungsten)] font-bold">1.</span>
                      <span>Click the Upgrade Plan button below</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[var(--tungsten)] font-bold">2.</span>
                      <span>Select Pro Engineer ($19/month)</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[var(--tungsten)] font-bold">3.</span>
                      <span>Instant unlimited questions & full sets</span>
                    </div>
                  </div>
                  <Link
                    href="/pricing"
                    className="mt-2.5 block w-full rounded bg-[var(--tungsten)] py-1.5 text-center font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Upgrade Plan
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "h-7 w-7 rounded-md border border-[var(--seam)]",
                      },
                    }}
                  />
                  <div className="truncate text-xs">
                    <div className="truncate font-medium text-[var(--ink-chalk)]">
                      {user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Engineer"}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--ink-dim)] truncate">
                      {isPro ? (
                        "Pro Member"
                      ) : isLimitExpired ? (
                        <span className="text-[var(--tungsten)] font-semibold">Limit Expired · 0 left</span>
                      ) : (
                        `Free Plan · ${questionsLeft} left`
                      )}
                    </div>
                  </div>
                </div>

                {!isPro && !isLimitExpired && (
                  <Link
                    href="/pricing"
                    className="font-mono text-[10px] text-[var(--ink-lead)] hover:text-[var(--tungsten)] transition-colors px-1.5 py-0.5 rounded border border-[var(--seam)] hover:border-[var(--tungsten)]"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Link
                href="/sign-in"
                className="w-full text-center rounded-md border border-[var(--seam)] bg-[var(--panel)] py-1.5 text-xs font-medium text-[var(--ink-chalk)] hover:border-[var(--tungsten)] transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main App Canvas (Positioned right of the Left Activity Bar) */}
      <div className="flex flex-1 flex-col md:pl-60 min-w-0">
        {/* Top Minimal Status Header in App Mode */}
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[var(--seam)] bg-[var(--substrate)]/95 px-4 sm:px-6 backdrop-blur-md">
          {/* Left: Mobile hamburger & route breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-md border border-[var(--seam)] p-1.5 text-[var(--ink-lead)] md:hidden hover:text-[var(--ink-chalk)]"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[var(--tungsten)]">//</span>
              <span className="text-[var(--ink-chalk)] font-medium uppercase tracking-wider">
                {pathname.split("/")[1] || "Workbench"}
              </span>
            </div>
          </div>

          {/* Right: Quick actions / Streak pill */}
          <div className="flex items-center gap-3">
            {isSignedIn && (
              <div className="flex items-center gap-2 rounded-md border border-[var(--seam)] bg-[var(--chassis)] px-2.5 py-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--tungsten)]" />
                <span className="font-mono text-[var(--ink-chalk)] tabular-nums">
                  {currentStreak}d streak
                </span>
              </div>
            )}

            {!isSignedIn && (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="rounded-md border border-[var(--seam)] bg-[var(--chassis)] px-3 py-1 text-xs font-medium text-[var(--ink-chalk)] hover:border-[var(--tungsten)]"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-[var(--tungsten)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-64 flex-col border-r border-[var(--seam)] bg-[var(--chassis)] p-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--tungsten)]">//</span>
                  <span className="text-sm font-bold text-[var(--ink-chalk)]">AI ACADEMY</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex-1 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-[var(--ink-chalk)] hover:bg-[var(--panel)]"
                  >
                    <span className="text-[var(--tungsten)]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
              {isSignedIn && (
                <div className="border-t border-[var(--seam)] pt-3">
                  {isLimitExpired && (
                    <div className="mb-3 rounded-md border border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 p-2.5 text-xs">
                      <div className="font-mono text-[10px] font-bold text-[var(--tungsten)]">
                        DAILY LIMIT EXPIRED
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--ink-chalk)]">
                        Upgrade to continue practicing without limits.
                      </p>
                      <Link
                        href="/pricing"
                        onClick={() => setMobileMenuOpen(false)}
                        className="mt-2 block w-full rounded bg-[var(--tungsten)] py-1.5 text-center font-mono text-xs font-semibold text-black"
                      >
                        Upgrade Plan
                      </Link>
                    </div>
                  )}
                  <UserButton />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Page Content Container */}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
