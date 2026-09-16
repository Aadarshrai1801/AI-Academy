import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * `<EmptyState>` — the shared zero-data surface (§3).
 *
 * Every list/grid in the app routes through this so "nothing here yet" is
 * always designed: icon, heading, one line of explanation, optional action.
 * The icon floats gently (CSS, reduced-motion-safe) so the state reads as
 * alive rather than broken.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Tighter padding for in-card use. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "grid place-items-center rounded-2xl border border-line bg-surface-3 text-fg-muted",
            compact ? "h-11 w-11" : "h-14 w-14",
            "animate-float",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className={cn("font-semibold text-fg", compact ? "mt-3 text-sm" : "mt-4 text-base")}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-fg-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}

/** Same contract, dashed-border variant for "drop zone" style slots. */
export function EmptyStateDashed(props: EmptyStateProps) {
  return (
    <EmptyState
      {...props}
      className={cn("rounded-card border border-dashed border-line-strong bg-surface-1", props.className)}
    />
  );
}
