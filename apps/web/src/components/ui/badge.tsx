import type { HTMLAttributes, ReactNode } from "react";
import {
  CircleCheck,
  CircleHelp,
  Info,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * `<Badge>` / `<Pill>` — semantic status chip (§3).
 *
 * Color is never the only signal (§4): every variant pairs its tone with an
 * icon when one is supplied, and the difficulty presets always render an
 * explicit label (EASY / MEDIUM / HARD).
 */
export type BadgeVariant =
  | "neutral"
  | "brand"
  | "iris"
  | "success"
  | "warning"
  | "error"
  | "info";

export type BadgeSize = "sm" | "md";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "border-line-strong bg-surface-3 text-fg-muted",
  brand: "border-brand/35 bg-brand-soft text-brand",
  iris: "border-iris/35 bg-iris-soft text-iris",
  success: "border-success/35 bg-success-soft text-success",
  warning: "border-warning/35 bg-warning-soft text-warning",
  error: "border-error/35 bg-error-soft text-error",
  info: "border-info/35 bg-info-soft text-info",
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 px-2 text-[10px]",
  md: "h-6 gap-1.5 px-2.5 text-[11px]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  /** Renders a small leading status dot — for live/presence states (§2.5). */
  dot?: boolean;
  /** Square-ish corners (for inline table tags) instead of the default pill. */
  square?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  icon,
  dot = false,
  square = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border font-mono font-semibold uppercase tracking-wide",
        square ? "rounded-md" : "rounded-full",
        SIZE_STYLES[size],
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="relative grid h-2 w-2 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-current" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-current" />
        </span>
      )}
      {icon}
      {children}
    </span>
  );
}

/** Convenience presets so semantic colors stay consistent app-wide. */
const BADGE_PRESET_ICON: Record<string, LucideIcon> = {
  success: CircleCheck,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

export interface StatusBadgeProps extends BadgeProps {
  variant: Extract<BadgeVariant, "success" | "error" | "warning" | "info">;
}

/** Status chip that always carries an icon (colorblind-safe). */
export function StatusBadge({ variant, children, ...props }: StatusBadgeProps) {
  const Icon = BADGE_PRESET_ICON[variant] ?? CircleHelp;
  return (
    <Badge variant={variant} icon={<Icon className="h-3 w-3" aria-hidden="true" />} {...props}>
      {children}
    </Badge>
  );
}

/**
 * Difficulty chip: rose = hard, amber = medium, emerald = easy (§2.3).
 * The label text is always present, so the chip is readable without color.
 */
export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_VARIANT: Record<Difficulty, BadgeVariant> = {
  easy: "success",
  medium: "warning",
  hard: "error",
};

export function DifficultyBadge({
  difficulty,
  size = "sm",
  className,
  ...props
}: Omit<BadgeProps, "variant" | "children"> & { difficulty: Difficulty }) {
  return (
    <Badge
      variant={DIFFICULTY_VARIANT[difficulty]}
      size={size}
      square
      className={cn("tracking-widest", className)}
      {...props}
    >
      {difficulty}
    </Badge>
  );
}
