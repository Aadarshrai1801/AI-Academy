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
      <div className="rounded-xl border border-line-strong bg-surface-2 p-6 shadow-card">
        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
          RUNTIME FAULT // SYSTEM EXCEPTION
        </div>
        <h1 className="mt-2 text-lg font-bold text-fg">
          Something went wrong rendering this page.
        </h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-fg-muted">
          {error.digest ? `Reference: ${error.digest}` : "The error was logged for review."}
        </p>
        <div className="mt-6 flex gap-3">
          {retryFn && (
            <button
              onClick={() => retryFn()}
              className="rounded-lg border border-transparent bg-fg text-surface-0 px-4 py-2 font-mono text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
            >
              Try again
            </button>
          )}
          <Link
            href="/dashboard"
            className="rounded-lg border border-line bg-surface-1 px-4 py-2 font-mono text-xs text-fg-muted transition-all hover:border-line-strong hover:text-fg"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
