"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * Route-level error boundary (Next 16 passes `retry`; `reset` is kept as a
 * fallback for older runtimes). Catches render errors in any route segment so
 * one broken page no longer blanks the whole app.
 */
export default function RouteError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const retryFn = retry ?? reset;

  useEffect(() => {
    Sentry.captureException(error, { extra: { digest: error.digest } });
    console.error("[ui] route error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-white/20 bg-white/[0.04] p-6 backdrop-blur-sm shadow-[0_0_25px_rgba(255,255,255,0.03)]">
        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
          RUNTIME FAULT // SYSTEM EXCEPTION
        </div>
        <h1 className="mt-2 text-lg font-bold text-[var(--fg)]">
          Something went wrong rendering this page.
        </h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-[var(--fg-muted)]">
          {error.digest ? `Reference: ${error.digest}` : "The error was logged for review."}
        </p>
        <div className="mt-6 flex gap-3">
          {retryFn && (
            <button
              onClick={() => retryFn()}
              className="rounded-lg border border-white bg-white px-4 py-2 font-mono text-xs font-semibold text-black transition-all hover:bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            >
              Try again
            </button>
          )}
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-4 py-2 font-mono text-xs text-[var(--fg-muted)] transition-all hover:border-[var(--line-strong)] hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
