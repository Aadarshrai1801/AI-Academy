"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Meteors — Aceternity-style (§1.3).
 *
 * Thin diagonal white/gray light trails drifting across. Used sparingly:
 * landing hero accent and correct-answer celebration burst. Each meteor is
 * a CSS-animated pseudo-element — no canvas or WebGL.
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function Meteors({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const delay = pseudoRandom(i * 4 + 1) * 5;
        const duration = 3 + pseudoRandom(i * 4 + 2) * 4;
        const left = `${pseudoRandom(i * 4 + 3) * 100}%`;
        const top = `${-10 + pseudoRandom(i * 4 + 4) * 40}%`;
        const opacity = 0.15 + pseudoRandom(i * 4 + 5) * 0.35;
        const height = 60 + pseudoRandom(i * 4 + 6) * 80;

        return (
          <span
            key={i}
            className="absolute rotate-[215deg] animate-meteor rounded-full"
            style={{
              left,
              top,
              width: "1px",
              height: `${height}px`,
              background: `linear-gradient(to bottom, rgba(255,255,255,${opacity}), transparent)`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              boxShadow: `0 0 2px rgba(255,255,255,${opacity * 0.5})`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * MeteorBurst — One-time celebratory burst variant (correct answer, milestones).
 * Fires once and fades, rather than looping infinitely.
 */
export function MeteorBurst({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const duration = 0.4 + pseudoRandom(i * 3 + 1) * 0.4;
        const length = 20 + pseudoRandom(i * 3 + 2) * 30;
        const opacity = 0.3 + pseudoRandom(i * 3 + 3) * 0.4;

        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: "1px",
              height: `${length}px`,
              background: `linear-gradient(to bottom, rgba(255,255,255,${opacity}), transparent)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "0 0",
              animation: `meteor ${duration}s ease-out forwards`,
              boxShadow: `0 0 2px rgba(255,255,255,${opacity * 0.4})`,
            }}
          />
        );
      })}
    </div>
  );
}
