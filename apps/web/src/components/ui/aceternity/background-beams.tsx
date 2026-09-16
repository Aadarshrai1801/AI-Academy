"use client";

import { cn } from "@/lib/cn";

/**
 * BackgroundBeams — Aceternity-style (§1.3).
 *
 * Slow-moving, low-opacity animated light streaks on a dark background.
 * Used for landing hero and CTA footer band. Pure white/gray — no hue.
 *
 * Implementation: CSS-animated pseudo-element beams rather than canvas/SVG
 * for simplicity and GPU-acceleration. Each beam is a thin rotated gradient
 * strip that drifts across the container.
 */
export function BackgroundBeams({
  className,
  beamCount = 5,
}: {
  className?: string;
  beamCount?: number;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {Array.from({ length: beamCount }, (_, i) => {
        const delay = i * 1.8;
        const angle = -30 + i * 15;
        const leftPct = 10 + i * 18;
        const opacity = 0.03 + ((i * 17) % 5) * 0.01;
        const duration = 8 + i * 2;

        return (
          <div
            key={i}
            className="absolute h-[200%] w-px animate-mesh-drift"
            style={{
              left: `${leftPct}%`,
              top: "-50%",
              transform: `rotate(${angle}deg)`,
              background: `linear-gradient(to bottom, transparent 0%, rgba(255,255,255,${opacity}) 30%, rgba(255,255,255,${opacity * 1.5}) 50%, rgba(255,255,255,${opacity}) 70%, transparent 100%)`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * AuroraBackground — Aceternity-style.
 *
 * A slow-moving, low-opacity gradient wash. Suitable for hero/marketing
 * sections. White/gray only.
 */
export function AuroraBackground({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className="absolute -inset-[100px] animate-mesh-drift opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 30% 50%, rgba(255,255,255,0.06), transparent 60%)," +
            "radial-gradient(ellipse 60% 80% at 70% 40%, rgba(255,255,255,0.04), transparent 50%)",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}
