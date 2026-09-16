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
    <div className="flex min-h-screen flex-col bg-surface-0 font-sans text-fg selection:bg-brand/30">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[background-color,border-color,height] duration-300 ease-out",
          scrolled ? "glass-panel border-b border-line" : "border-b border-transparent",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-7xl items-center justify-between px-4 transition-[height] duration-300 ease-out sm:px-8",
            scrolled ? "h-14" : "h-16",
          )}
        >
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-brand/40 bg-brand-soft font-mono text-xs font-bold text-brand shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-transform group-hover:scale-105">
              {"//"}
            </span>
            <span className="text-base font-bold tracking-tight text-fg">AI ACADEMY</span>
            <span className="hidden rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-brand sm:inline-block">
              AI Workbench
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-medium text-fg-muted md:flex">
            <a href="#features" className="transition-colors hover:text-fg">
              Features
            </a>
            <a href="#curriculum" className="transition-colors hover:text-fg">
              Curriculum
            </a>
            <Link href="/pricing" className="transition-colors hover:text-fg">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link
                  href="/practice"
                  className="hidden items-center rounded-btn border border-brand bg-brand px-4 py-2 text-xs font-semibold text-on-brand shadow-[0_0_12px_rgba(249,115,22,0.25)] transition-opacity hover:opacity-90 sm:flex"
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
                  className="rounded-btn px-3.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center rounded-btn border border-brand bg-brand px-4 py-1.5 text-xs font-semibold text-on-brand shadow-[0_0_12px_rgba(249,115,22,0.25)] transition-opacity hover:opacity-90"
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
          <div className="flex items-center gap-2 font-mono">
            <span className="text-brand">{"//"}</span>
            <span>AI ACADEMY — High-Performance Learning Engine for AI &amp; Machine Learning Engineers</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <a href="#features" className="hover:text-fg">
              Features
            </a>
            <a href="#curriculum" className="hover:text-fg">
              Curriculum
            </a>
            <Link href="/pricing" className="hover:text-fg">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-fg">
              Terms
            </Link>
            <Link href="/sign-in" className="hover:text-fg">
              Sign In
            </Link>
            <Link href="/sign-up" className="hover:text-fg">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
