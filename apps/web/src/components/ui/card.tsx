import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * `<Card>` — content-panel surface role (design plan §3).
 * Flat by design: a hairline and grouping do the work, not a shadow. Elevation
 * is reserved for genuinely floating layers (popovers, pinned rows).
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "surface-card",
        interactive && [
          "cursor-pointer transition-[border-color,background-color] duration-200 ease-out",
          "hover:border-line-strong hover:bg-surface-3",
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

