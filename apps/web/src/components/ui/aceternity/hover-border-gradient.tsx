"use client";

import { useRef, useState, useCallback } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * HoverBorderGradient — Aceternity-style (§1.3).
 *
 * On hover, the border lights up with an accent gradient glow that follows
 * the cursor position. More subtle than MovingBorder — good for secondary
 * CTAs and featured elements.
 */
export function HoverBorderGradient({
  children,
  className,
  containerClassName,
  as: Tag = "button",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  as?: "button" | "a" | "div";
} & React.HTMLAttributes<HTMLElement>) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  return (
    <Tag
      className={cn("group relative inline-flex", containerClassName)}
      {...(props as Record<string, unknown>)}
    >
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-btn p-[1px]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
      >
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-btn transition-opacity duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            background: reduced
              ? "rgba(79,70,229,0.20)"
              : `radial-gradient(circle at ${position.x}% ${position.y}%, rgba(79,70,229,0.40) 0%, rgba(99,102,241,0.08) 50%, transparent 80%)`,
          }}
          aria-hidden="true"
        />
        {/* Static border */}
        <div
          className="absolute inset-0 rounded-btn border border-line transition-colors group-hover:border-line-strong"
          aria-hidden="true"
        />

        <div className={cn("relative rounded-[calc(0.5rem-1px)] bg-surface-2", className)}>
          {children}
        </div>
      </div>
    </Tag>
  );
}
