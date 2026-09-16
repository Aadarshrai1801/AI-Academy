import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * `<Skeleton>` — shimmering placeholder (§3).
 *
 * Used wherever data is in flight so the layout does not jump when content
 * lands. Size it to the shape it stands in for (card, KPI tile, list row)
 * rather than shipping a single generic grey bar.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-lg bg-surface-3",
        // Shimmer sweep: a soft white band over the dark placeholder.
        "bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** N stacked text lines, last one short — mirrors a paragraph. */
export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full", lineClassName)}
        />
      ))}
    </div>
  );
}

/** Stand-in for a KPI tile (Dashboard, Leaderboard standing bar). */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface-2 p-5", className)}
      aria-hidden="true"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

/** Stand-in for a list row (leaderboard rank, recent inquiries, call log). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3.5", className)} aria-hidden="true">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0" />
    </div>
  );
}

/** Stand-in for a chart canvas: baseline + a few bars. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-40 items-end gap-2", className)} aria-hidden="true">
      {[42, 68, 35, 84, 57, 74, 46].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
