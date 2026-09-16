import Link from "next/link";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

/** Global 404 for unmatched routes (renders inside the root layout). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6">
      <CardSpotlight className="w-full max-w-lg border-white/20">
        <div className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 font-mono text-sm font-bold text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
            404
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Route Not Located
          </h1>
          <p className="mt-2 font-mono text-xs leading-relaxed text-[var(--fg-muted)]">
            The neural pathway or endpoint you requested does not exist or has been relocated.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-white bg-white px-4 py-2 font-mono text-xs font-semibold text-black transition-all hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              Back to dashboard
            </Link>
            <Link
              href="/practice"
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 font-mono text-xs text-[var(--fg-muted)] transition-all hover:border-[var(--line-strong)] hover:text-white"
            >
              Resume practice
            </Link>
          </div>
        </div>
      </CardSpotlight>
    </main>
  );
}
