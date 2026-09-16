"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 * Must render its own <html>/<body>; global styles are imported explicitly
 * because this document replaces the root layout.
 */
export default function GlobalError({
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
    Sentry.captureException(error, { extra: { digest: error.digest, fatal: true } });
    console.error("[ui] global error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--surface-0)] font-sans text-[var(--fg)] antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
            CRITICAL FAULT // CORE RUNTIME
          </div>
          <h1 className="mt-3 text-xl font-bold text-fg">The application failed to start.</h1>
          <p className="mt-2 font-mono text-xs text-[var(--fg-muted)]">
            {error.digest ? `Reference: ${error.digest}` : "Please retry or contact support."}
          </p>
          {retryFn && (
            <button
              onClick={() => retryFn()}
              className="mt-6 rounded-lg border border-transparent bg-fg px-5 py-2 font-mono text-xs font-semibold text-surface-0 transition-all hover:opacity-90 shadow-sm"
            >
              Reload application
            </button>
          )}
        </main>
      </body>
    </html>
  );
}
