"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * BackgroundGradient — Aceternity-style (§1.3).
 *
 * Subtle animated accent-glow border wrapper. Wraps a child element with a
 * slowly pulsing border glow to make it stand out using the single accent.
 *
 * Used for "Your Standing" leaderboard bar and any single featured element.
 */
export function BackgroundGradient({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;

  return (
    <div className={cn("group relative p-[1px] rounded-card", containerClassName)}>
      {/* Animated glow border */}
      {shouldAnimate ? (
        <motion.div
          className="absolute inset-0 rounded-card opacity-60"
          animate={{
            boxShadow: [
              "0 0 20px rgba(79,70,229,0.12)",
              "0 0 40px rgba(79,70,229,0.22)",
              "0 0 20px rgba(79,70,229,0.12)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          aria-hidden="true"
        />
      ) : null}

      {/* Static glow fallback */}
      <div
        className="absolute inset-0 rounded-card border border-line-strong"
        style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.06) 0%, transparent 50%, rgba(99,102,241,0.04) 100%)",
        }}
        aria-hidden="true"
      />

      <div className={cn("relative rounded-[calc(0.875rem-1px)] bg-surface-2", className)}>
        {children}
      </div>
    </div>
  );
}
