"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * Spotlight — Aceternity-style (§1.3).
 *
 * A soft white radial gradient that optionally follows the cursor, simulating
 * a stage light from above. Used on the landing hero and behind Dashboard KPIs.
 *
 * The gradient is rendered as a CSS background on a pointer-events-none div,
 * so it never interferes with clicks.
 */
export function Spotlight({
  className,
  fill = "white",
  size = 600,
  followCursor = false,
}: {
  className?: string;
  fill?: string;
  size?: number;
  followCursor?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 50, y: 0 });

  useEffect(() => {
    if (!followCursor) return;
    const container = containerRef.current?.parentElement;
    if (!container) return;

    function handleMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x, y });
    }

    container.addEventListener("mousemove", handleMove);
    return () => container.removeEventListener("mousemove", handleMove);
  }, [followCursor]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className="absolute animate-spotlight"
        style={{
          width: size,
          height: size,
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${fill === "white" ? "rgba(255,255,255,0.12)" : fill} 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}
