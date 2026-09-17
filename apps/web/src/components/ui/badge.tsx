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
 * `<Badge>` / `<Pill>` — status chip (§3).
 *
 * Variants are differentiated by fill weight and semantic hue:
 * - `solid`: accent indigo fill (strongest emphasis)
 * - `medium`: neutral surface fill
 * - `outline`: transparent + hairline border (lightest)
 * - `neutral`: default subtle chip
 *
 * Legacy variant names (brand, iris, success, etc.) are preserved as aliases
 * mapping to the accent / semantic status tints.
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
  solid: "border-transparent bg-brand text-on-brand font-medium",
  medium: "border-line bg-surface-3 text-fg font-medium",
  outline: "border-line bg-transparent text-fg-muted",
  // Legacy aliases → accent / semantic mappings
  brand: "border-transparent bg-brand-soft text-brand-ink",
  iris: "border-transparent bg-brand-soft text-brand-ink",
  success: "border-transparent bg-state-positive-soft text-state-positive-ink",
  warning: "border-transparent bg-state-warning-soft text-state-warning-ink",
  error: "border-transparent bg-state-negative-soft text-state-negative-ink",
  info: "border-transparent bg-state-info-soft text-state-info-ink",
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
 * Difficulty chip — differentiated by fill weight and accent intensity (§2.3):
 * - Hard = solid (accent indigo fill — strongest)
 * - Medium = medium (neutral fill)
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
