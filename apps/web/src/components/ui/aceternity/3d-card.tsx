"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * ThreeDCard — Aceternity-style (§1.3).
 *
 * Subtle cursor-tracked 3D tilt. Tilts toward the cursor on hover, creating
 * a "floating" feel. The cursor-following glare overlay was removed.
 *
 * Used for the landing page product-preview mock.
 */
export function ThreeDCard({
  className,
  children,
  maxTilt = 8,
}: {
  className?: string;
  children: React.ReactNode;
  maxTilt?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -maxTilt;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * maxTilt;
      setTransform({ rotateX, rotateY });
    },
    [maxTilt, reduced],
  );

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <div style={{ perspective: "1000px" }} className={cn("relative", className)}>
      <motion.div
        ref={cardRef}
        className="relative"
        animate={{
          rotateX: transform.rotateX,
          rotateY: transform.rotateY,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
