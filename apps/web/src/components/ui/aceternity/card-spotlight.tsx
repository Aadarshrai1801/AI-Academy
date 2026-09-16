"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

/**
 * CardSpotlight — Aceternity-style (§1.3).
 *
 * A card that shows a cursor-following white radial glow on hover.
 * This is one of the most recognizable Aceternity signatures — the glow
 * reads as "light falling on the card" and communicates hover without
 * needing a border color change.
 *
 * Usage: wrap any card content to get the spotlight effect.
 */
export function CardSpotlight({
  className,
  children,
  radius = 250,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
  radius?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const div = divRef.current;
      if (!div) return;
      const rect = div.getBoundingClientRect();
      setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [],
  );

  const handleMouseEnter = useCallback(() => setOpacity(1), []);
  const handleMouseLeave = useCallback(() => setOpacity(0), []);

  return (
    <div
      ref={divRef}
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-surface-2",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Spotlight glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-card transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, var(--glow, rgba(0,0,0,0.04)), transparent 60%)`,
        }}
        aria-hidden="true"
      />
      {/* Border glow (brighter ring near cursor) */}
      <div
        className="pointer-events-none absolute -inset-px rounded-card transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${radius * 0.6}px circle at ${position.x}px ${position.y}px, var(--glow-strong, rgba(0,0,0,0.08)), transparent 50%)`,
          maskImage: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, black 0%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, black 0%, transparent 100%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
