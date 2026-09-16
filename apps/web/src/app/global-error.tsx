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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--substrate)] font-sans text-[var(--ink-chalk)] antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
          <div className="font-mono text-xs font-semibold text-[var(--diverged)]">
            CRITICAL FAULT
          </div>
          <h1 className="mt-3 text-xl font-bold">The application failed to start.</h1>
          <p className="mt-2 font-mono text-xs text-[var(--ink-lead)]">
            {error.digest ? `Reference: ${error.digest}` : "Please retry or contact support."}
          </p>
          {retryFn && (
            <button
              onClick={() => retryFn()}
              className="mt-6 rounded border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-on-brand hover:opacity-90"
            >
              Reload application
            </button>
          )}
        </main>
      </body>
    </html>
  );
}
