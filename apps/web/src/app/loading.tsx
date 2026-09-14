/**
 * Instant loading UI for route transitions. Server Components stream in
 * behind this fallback instead of leaving the user on a frozen page.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6" aria-busy="true">
      <div className="animate-pulse space-y-4" role="status" aria-label="Loading">
        <div className="h-3 w-32 rounded bg-[var(--seam)]" />
        <div className="h-8 w-2/3 rounded bg-[var(--seam)]/70" />
        <div className="h-24 rounded-lg bg-[var(--chassis)]" />
        <div className="h-24 rounded-lg bg-[var(--chassis)]" />
        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
