"use client";

import { cn } from "@/lib/cn";

/**
 * Spotlight — Aceternity-style (§1.3).
 *
 * A soft accent-tinted radial gradient, simulating a stage light from above.
 * Used on the landing hero and behind Dashboard KPIs.
 *
 * The gradient is rendered as a CSS background on a pointer-events-none div,
 * so it never interferes with clicks. It is static — it does not track the
 * cursor.
 */
export function Spotlight({
  className,
  fill = "accent",
  size = 600,
}: {
  className?: string;
  fill?: string;
  size?: number;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className="absolute animate-spotlight"
        style={{
          width: size,
          height: size,
          left: "50%",
          top: "0%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${
            fill === "white" || fill === "accent" ? "rgba(79,70,229,0.12)" : fill
          } 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}
