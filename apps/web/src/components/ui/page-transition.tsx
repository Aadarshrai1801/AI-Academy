"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";

/**
 * Page transition wrapper (§3, §5).
 *
 * Wired into `app/template.tsx` in Phase 2, where Next remounts the subtree on
 * every navigation — which is exactly the trigger this needs. Enter-only by
 * design: the App Router does not keep the outgoing tree mounted, so an exit
 * animation would be a lie. 12px rise + fade in ~200ms is fast enough to feel
 * instant while still reading as a transition.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: EASE.outExpo }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
