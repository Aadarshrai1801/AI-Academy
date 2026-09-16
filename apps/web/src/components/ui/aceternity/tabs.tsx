"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

/**
 * AnimatedTabs — Aceternity-style (§1.3).
 *
 * An animated underline/pill that slides between tab items on selection.
 * Uses Framer Motion's `layoutId` for the sliding pill, creating a smooth
 * spring transition between tabs. Same pattern as the sidebar active pill.
 */
export function AnimatedTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  layoutId = "animated-tab",
}: {
  tabs: Array<{ value: string; label: string }>;
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
  layoutId?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-0.5 rounded-btn border border-line bg-surface-3 p-0.5",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "relative rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={reduced ? { duration: 0 } : SPRING.snappy}
                className="absolute inset-0 rounded-[6px] bg-surface-4 shadow-card"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
