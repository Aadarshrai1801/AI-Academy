"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  BUTTON_BASE,
  BUTTON_SIZE_STYLES,
  BUTTON_VARIANT_STYLES,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";

/**
 * `<Button>` — the single button primitive (§3).
 *
 * Variants: primary (accent), secondary, ghost, destructive.
 * States: default → hover (lift + glow), active (0.97 press), loading,
 * disabled. Focus rings come from the global `:focus-visible` rule, so
 * keyboard users get the same affordance as pointer users.
 *
 * Loading never shifts layout: the label stays in flow at `opacity-0` while
 * the spinner is absolutely centred, so width is preserved for free (no
 * measure-and-lock dance, which breaks on font swaps and zoom).
 *
 * The class recipe lives in `button-styles.ts` — a server-safe module — so
 * anchors rendered from server components can wear the same look.
 */
export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  /** Nudges 4px right on hover — the "forward motion" affordance (§2.3). */
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileHover={reduced || disabled || loading ? undefined : { y: -1 }}
      whileTap={reduced || disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        BUTTON_BASE,
        "group relative",
        "disabled:pointer-events-none disabled:opacity-45",
        BUTTON_VARIANT_STYLES[variant],
        BUTTON_SIZE_STYLES[size],
        className,
      )}
      {...props}
    >
      {/* Label stays mounted so the button keeps its width while loading. */}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && (
          <span className="inline-flex shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-1">
            {rightIcon}
          </span>
        )}
      </span>

      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
    </motion.button>
  );
});

/** Full-bleed icon-only square button — used in toolbars and row actions. */
export interface IconButtonProps extends ButtonProps {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "sm", variant = "ghost", className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      className={cn("w-8 px-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
});
