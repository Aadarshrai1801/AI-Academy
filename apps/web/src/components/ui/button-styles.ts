import { cn } from "@/lib/cn";

/**
 * Button styling recipe — deliberately in its own **server-safe** module.
 *
 * `button.tsx` carries `"use client"` because it animates, and a server
 * component cannot call into a client module: exporting this recipe from there
 * broke `/leaderboard` prerendering with "Attempted to call buttonStyles()
 * from the server". Keeping the class maps and the helper here means anchors in
 * server components can wear the exact same button look without duplicating
 * class strings or pulling the interactive component client-side.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export const BUTTON_VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-fg text-surface-0 shadow-sm hover:opacity-90 active:scale-[0.98]",
  secondary:
    "border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3 shadow-xs",
  ghost: "border border-transparent bg-transparent text-fg-muted hover:bg-surface-3 hover:text-fg",
  destructive:
    "border border-dashed border-line-strong bg-transparent text-fg-dim hover:border-fg-dim hover:bg-surface-3 hover:text-fg-muted",
};

export const BUTTON_SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-sm",
};

export const BUTTON_BASE =
  "inline-flex select-none items-center justify-center rounded-btn font-medium whitespace-nowrap transition-colors duration-150 ease-out";

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BUTTON_BASE, BUTTON_VARIANT_STYLES[variant], BUTTON_SIZE_STYLES[size], className);
}
