"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

/**
 * AnimatedTooltip — Aceternity-style (§1.3).
 *
 * A spring-animated tooltip that appears on hover with a scale + y pop.
 * Used for avatar stacks (Study Groups) and leaderboard rank rows.
 */
export function AnimatedTooltip({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const reduced = useReducedMotion();

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={SPRING.pop}
            className="absolute -top-2 left-1/2 z-50 -translate-x-1/2 -translate-y-full"
          >
            <div className="rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-xs text-fg shadow-pop whitespace-nowrap">
              {content}
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px">
              <div className="h-2 w-2 rotate-45 border-b border-r border-line-strong bg-surface-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
