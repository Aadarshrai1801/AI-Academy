"use client";

import { cn } from "@/lib/cn";

/**
 * BentoGrid — Aceternity-style (§1.3).
 *
 * A varied-size card grid layout where some items span multiple columns/rows.
 * Each item can be given a `span` prop to control its size. The grid auto-fills
 * with equal-sized items by default.
 *
 * Used for landing features/curriculum and Dashboard KPI + chart area.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[minmax(180px,auto)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  children,
  colSpan = 1,
  rowSpan = 1,
}: {
  className?: string;
  children: React.ReactNode;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
}) {
  const colClasses = {
    1: "",
    2: "sm:col-span-2",
    3: "sm:col-span-2 lg:col-span-3",
  };
  const rowClasses = {
    1: "",
    2: "row-span-2",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card border border-line bg-surface-2 p-5 shadow-card transition-shadow hover:shadow-glow",
        colClasses[colSpan],
        rowClasses[rowSpan],
        className,
      )}
    >
      {children}
    </div>
  );
}
