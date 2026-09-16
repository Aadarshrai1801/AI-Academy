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
 * `<Badge>` / `<Pill>` — monochrome status chip (§3).
 *
 * Variants are differentiated by fill weight, not hue:
 * - `solid`: white bg / black text (strongest emphasis)
 * - `medium`: 50%-gray fill
 * - `outline`: transparent + white border (lightest)
 * - `neutral`: default subtle chip
 *
 * Legacy variant names (brand, iris, success, etc.) are preserved as aliases
 * mapping to the appropriate monochrome fill weight.
 */
export type BadgeVariant =
  | "neutral"
  | "solid"
  | "medium"
  | "outline"
  | "brand"
  | "iris"
  | "success"
  | "warning"
  | "error"
  | "info";

export type BadgeSize = "sm" | "md";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "border-line bg-surface-3 text-fg-muted",
  solid: "border-transparent bg-fg text-surface-0 font-medium",
  medium: "border-line bg-surface-3 text-fg font-medium",
  outline: "border-line bg-transparent text-fg-muted",
  // Legacy aliases → monochrome mappings
  brand: "border-line bg-surface-3 text-fg",
  iris: "border-line bg-surface-3 text-fg",
  success: "border-line bg-state-positive-soft text-fg",
  warning: "border-line bg-state-warning-soft text-fg-muted",
  error: "border-line bg-state-negative-soft text-fg-dim",
  info: "border-line bg-surface-3 text-fg-muted",
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

/** Convenience presets so semantic states stay consistent app-wide. */
const BADGE_PRESET_ICON: Record<string, LucideIcon> = {
  success: CircleCheck,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

export interface StatusBadgeProps extends BadgeProps {
  variant: Extract<BadgeVariant, "success" | "error" | "warning" | "info">;
}

/** Status chip that always carries an icon (colorblind-safe — §4). */
export function StatusBadge({ variant, children, ...props }: StatusBadgeProps) {
  const Icon = BADGE_PRESET_ICON[variant] ?? CircleHelp;
  return (
    <Badge variant={variant} icon={<Icon className="h-3 w-3" aria-hidden="true" />} {...props}>
      {children}
    </Badge>
  );
}

/**
 * Difficulty chip — differentiated by fill weight, not color (§2.3):
 * - Hard = solid (white bg / black text — strongest)
 * - Medium = medium (gray fill)
 * - Easy = outline (transparent, just border)
 */
export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_VARIANT: Record<Difficulty, BadgeVariant> = {
  easy: "outline",
  medium: "medium",
  hard: "solid",
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
