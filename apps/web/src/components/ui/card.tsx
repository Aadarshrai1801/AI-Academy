import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * `<Card>` — layered elevated surface (§3).
 *
 * Surfaces step up the `surface-0 → surface-4` neutral ramp and add a subtle
 * shadow + faint border, so a card visibly lifts off the canvas.
 *
 * `interactive` adds hover glow (accent-tinted radial light) + pointer cursor.
 * The glow-on-hover is the Aceternity signature hover affordance.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** @deprecated — accent variants consolidated into the token system. Kept for compat. */
  accent?: "brand" | "iris" | "cyan" | "none";
}

export function Card({
  className,
  interactive = false,
  accent: _ = undefined,
  ...props
}: CardProps) {
  void _;
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-2 shadow-card",
        interactive && [
          "cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-out",
          "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-glow",
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold tracking-tight text-fg sm:text-base", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-relaxed text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/** Small monospace "system" label used for card eyebrows. */
export function CardEyebrow({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

