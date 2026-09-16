"use client";

import { cn } from "@/lib/cn";

/**
 * GridBackground — Aceternity-style (§1.3).
 *
 * Faint dot-grid or line-grid pattern with a radial mask that fades out toward
 * the edges. Used as a base texture on every dark page to replace flat black.
 */
export function GridBackground({
  className,
  variant = "dot",
  children,
}: {
  className?: string;
  variant?: "dot" | "dot-faint" | "line";
  children?: React.ReactNode;
}) {
  const gridClass =
    variant === "dot"
      ? "bg-dot-grid"
      : variant === "line"
        ? "bg-line-grid"
        : "bg-dot-grid-faint";

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-grid-mask",
          gridClass,
        )}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
