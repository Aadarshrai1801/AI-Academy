"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/cn";

/**
 * Marketing chrome for the logged-out landing page.
 *
 * Scroll-aware: the bar is transparent over the hero and only gains its glass
 * background, hairline border and slightly reduced height once the page has
 * scrolled past it. That keeps the hero artwork uninterrupted while giving the
 * nav contrast the moment it sits over real content.
 *
 * The listener is passive and writes to state only when the boolean flips, so
 * it does not re-render on every scroll event.
 */
export function LandingChrome({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-surface-0 font-sans text-fg selection:bg-white/20 selection:text-white">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[background-color,border-color,height] duration-300 ease-out",
          scrolled ? "glass-panel border-b border-line bg-surface-0/80 backdrop-blur-md" : "border-b border-transparent",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-7xl items-center justify-between px-4 transition-[height] duration-300 ease-out sm:px-8",
            scrolled ? "h-14" : "h-16",
          )}
        >
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/25 bg-white/5 font-mono text-xs font-bold text-white shadow-[0_0_12px_rgba(255,255,255,0.15)] transition-all group-hover:border-white/50 group-hover:scale-105">
              {"//"}
            </span>
            <span className="text-base font-bold tracking-tight text-white">AI ACADEMY</span>
            <span className="hidden rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[var(--fg-muted)] sm:inline-block">
              Workbench
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-medium text-fg-muted md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#curriculum" className="transition-colors hover:text-white">
              Curriculum
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link
                  href="/practice"
                  className="hidden items-center rounded-lg border border-white bg-white px-4 py-2 font-mono text-xs font-semibold text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all hover:bg-white/90 sm:flex"
                >
                  Launch Workbench
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-8 w-8 rounded-md border border-line-strong",
                    },
                  }}
                />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium text-fg-muted transition-colors hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center rounded-lg border border-white bg-white px-4 py-1.5 font-mono text-xs font-semibold text-black shadow-[0_0_12px_rgba(255,255,255,0.2)] transition-all hover:bg-white/90"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-line bg-surface-0 px-6 py-8 text-xs text-fg-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-white">{"//"}</span>
            <span>AI ACADEMY — High-Performance Learning Engine for AI &amp; Machine Learning Engineers</span>
          </div>
          <div className="flex items-center gap-5 text-xs font-mono text-[11px]">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#curriculum" className="hover:text-white transition-colors">
              Curriculum
            </a>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up" className="hover:text-white transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
