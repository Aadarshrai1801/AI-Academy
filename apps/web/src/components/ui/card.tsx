import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * `<Card>` — layered elevated surface (§3).
 *
 * Surfaces step up the `surface-0 → surface-4` ramp and add a soft shadow, so
 * a card visibly lifts off the canvas instead of relying on a 1px border.
 *
 * `interactive` adds hover-lift (4px) + accent border glow + pointer cursor.
 * Implemented in CSS rather than Framer Motion on purpose: it is a pure hover
 * affordance, needs no JS, keeps Card usable from server components, and is
 * neutralised automatically by the global reduced-motion guard.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Accent used for the interactive border glow. */
  accent?: "brand" | "iris" | "cyan" | "none";
}

const ACCENT_HOVER: Record<NonNullable<CardProps["accent"]>, string> = {
  brand: "hover:border-[var(--brand-ring)]",
  iris: "hover:border-[var(--iris-ring)]",
  cyan: "hover:border-cyan/40",
  none: "",
};

export function Card({
  className,
  interactive = false,
  accent = "brand",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-2 shadow-card",
        interactive && [
          "cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-out",
          "hover:-translate-y-1 hover:shadow-lift",
          ACCENT_HOVER[accent],
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

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 border-t border-line px-5 py-4", className)}
      {...props}
    />
  );
}

/** Small monospace "system" label used for card eyebrows (`ML-BASICS // ATTENTION`). */
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

/** KPI tile: eyebrow + animated value + delta hint. Consumed by Dashboard. */
export interface StatCardProps extends Omit<CardProps, "children"> {
  eyebrow: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

export function StatCard({ eyebrow, value, hint, icon, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("p-5", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <CardEyebrow>{eyebrow}</CardEyebrow>
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-fg-muted">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </Card>
  );
}
