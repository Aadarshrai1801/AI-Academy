"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * MovingBorder — Aceternity-style (§1.3).
 *
 * An animated white light that travels around the button border on hover.
 * Built with CSS offset-path on a pseudo-element that traces the border rect.
 *
 * Used for primary CTAs: "Sign Up", "Submit answer", "Start Call".
 */
export function MovingBorder({
  children,
  className,
  containerClassName,
  borderRadius = "0.5rem",
  duration = 3000,
  as: Tag = "button",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  borderRadius?: string;
  duration?: number;
  as?: "button" | "a" | "div";
} & React.HTMLAttributes<HTMLElement>) {
  const reduced = useReducedMotion();
  const pathId = useId();

  return (
    <Tag
      className={cn(
        "group relative overflow-hidden bg-transparent p-[1px]",
        containerClassName,
      )}
      style={{ borderRadius }}
      {...(props as Record<string, unknown>)}
    >
      {/* Animated border light */}
      <div
        className="absolute inset-0"
        style={{ borderRadius }}
        aria-hidden="true"
      >
        <svg
          className="absolute h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            id={pathId}
            x="0"
            y="0"
            width="100"
            height="100"
            fill="none"
            rx="8"
            ry="8"
          />
        </svg>
        {!reduced && (
          <motion.div
            className="absolute h-5 w-5 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)",
              offsetPath: `rect(0% 100% 100% 0% round ${borderRadius})`,
              offsetDistance: "0%",
              filter: "blur(2px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              offsetDistance: ["0%", "100%"],
            }}
            transition={{
              duration: duration / 1000,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
        {/* Static border fallback */}
        <div
          className="absolute inset-0 border border-line-strong opacity-40 group-hover:opacity-70 transition-opacity"
          style={{ borderRadius }}
        />
      </div>

      {/* Content */}
      <div
        className={cn(
          "relative z-10 rounded-[calc(0.5rem-1px)] bg-surface-2",
          className,
        )}
        style={{ borderRadius: `calc(${borderRadius} - 1px)` }}
      >
        {children}
      </div>
    </Tag>
  );
}
