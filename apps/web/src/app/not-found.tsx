import Link from "next/link";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

/** Global 404 for unmatched routes (renders inside the root layout). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6">
      <CardSpotlight className="w-full max-w-lg border-line shadow-card">
        <div className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface-3 font-mono text-sm font-bold text-fg shadow-sm">
            404
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-fg sm:text-2xl">
            Route Not Located
          </h1>
          <p className="mt-2 font-mono text-xs leading-relaxed text-fg-muted">
            The neural pathway or endpoint you requested does not exist or has been relocated.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-transparent bg-brand px-4 py-2 font-mono text-xs font-semibold text-on-brand transition-all hover:bg-brand-strong shadow-sm"
            >
              Back to dashboard
            </Link>
            <Link
              href="/practice"
              className="rounded-lg border border-line bg-surface-2 px-4 py-2 font-mono text-xs text-fg-muted transition-all hover:border-line-strong hover:text-fg"
            >
              Resume practice
            </Link>
          </div>
        </div>
      </CardSpotlight>
    </main>
  );
}
