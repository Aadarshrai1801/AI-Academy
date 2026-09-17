"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * ThreeDCard — Aceternity-style (§1.3).
 *
 * Subtle cursor-tracked 3D tilt with an accent glare highlight on the card
 * surface. Tilts toward the cursor on hover, creating a "floating" feel.
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
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

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
      setGlarePosition({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    },
    [maxTilt, reduced],
  );

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}

        {/* Accent glare overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-card transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(79,70,229,0.06) 0%, transparent 50%)`,
          }}
          aria-hidden="true"
        />
      </motion.div>
    </div>
  );
}
