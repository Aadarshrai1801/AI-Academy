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
      <div className="rounded-lg border border-[var(--diverged)]/40 bg-[var(--diverged)]/10 p-6">
        <div className="font-mono text-xs font-semibold text-[var(--diverged)]">
          RUNTIME FAULT
        </div>
        <h1 className="mt-2 text-lg font-bold text-[var(--ink-chalk)]">
          Something went wrong rendering this page.
        </h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-[var(--ink-lead)]">
          {error.digest ? `Reference: ${error.digest}` : "The error was logged for review."}
        </p>
        <div className="mt-6 flex gap-3">
          {retryFn && (
            <button
              onClick={() => retryFn()}
              className="rounded border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-1.5 font-mono text-xs font-semibold text-on-brand hover:opacity-90"
            >
              Try again
            </button>
          )}
          <Link
            href="/"
            className="rounded border border-[var(--seam)] px-4 py-1.5 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
