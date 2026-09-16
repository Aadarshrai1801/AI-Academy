"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Magnetic hover wrapper (§2.1).
 *
 * The child drifts up to 4px toward the cursor, then springs back when the
 * pointer leaves. Two constraints keep it tasteful:
 * - it only engages on devices with a real pointer, so touch users never see a
 *   button that lags behind their thumb;
 * - it is skipped entirely under reduced motion.
 *
 * Press feedback (0.97) is handled here so callers get it for free.
 */
export function Magnetic({
  children,
  className,
  strength = 4,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum travel in px. The brief caps this at 6. */
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [finePointer, setFinePointer] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 300, damping: 20 });
  const y = useSpring(rawY, { stiffness: 300, damping: 20 });

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const element = ref.current;
    if (!element) return;
    if (event.pointerType !== "mouse") return;
    const rect = element.getBoundingClientRect();
    const offsetX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const offsetY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    rawX.set(Math.max(-1, Math.min(1, offsetX)) * strength);
    rawY.set(Math.max(-1, Math.min(1, offsetY)) * strength);
  }

  function reset() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      style={finePointer && !reduced ? { x, y } : undefined}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => setFinePointer(event.pointerType === "mouse")}
      onPointerLeave={() => {
        setFinePointer(false);
        reset();
      }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}
