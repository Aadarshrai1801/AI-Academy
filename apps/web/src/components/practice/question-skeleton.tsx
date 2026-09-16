"use client";

import { Skeleton, SkeletonText } from "@/components/ui";

/**
 * Loading skeleton for the practice workbench (§2.2, §3).
 *
 * Mirrors the real two-pane geometry — prompt block, diagram frame, option
 * rows — so the layout does not jump when the question lands, and the wait
 * reads as "your question is being prepared" rather than a blank page.
 * Appears within the same frame that previously showed only a spinner.
 */
export function QuestionSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12" aria-hidden="true">
      {/* Left pane: problem specification */}
      <div className="flex flex-col rounded-card border border-line bg-surface-2 p-6 lg:col-span-7">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mt-4">
          <SkeletonText lines={3} />
        </div>
        <div className="mt-5 rounded-card border border-line bg-surface-0 p-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>

      {/* Right pane: options */}
      <div className="flex flex-col rounded-card border border-line bg-surface-2 p-6 lg:col-span-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-start gap-3 rounded-card border border-line bg-surface-3 p-3.5"
            >
              <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
