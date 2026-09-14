import Link from "next/link";

/** Global 404 for unmatched routes (renders inside the root layout). */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
        <div className="font-mono text-xs font-semibold text-[var(--tungsten)]">404</div>
        <h1 className="mt-2 text-lg font-bold text-[var(--ink-chalk)]">Page not found.</h1>
        <p className="mt-2 font-mono text-xs text-[var(--ink-lead)]">
          The page you requested does not exist or was moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded border border-[var(--seam)] px-4 py-1.5 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
