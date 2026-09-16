"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/cn";

/**
 * InfiniteMovingCards — Aceternity-style (§1.3).
 *
 * Auto-scrolling horizontal strip of cards. CSS-only animation (translateX)
 * with duplicated items to create the seamless loop illusion.
 *
 * Used for landing page topic strip and leaderboard's Daily Gauntlet ticker.
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
  renderItem,
}: {
  items: readonly unknown[];
  direction?: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
  className?: string;
  renderItem: (item: unknown, index: number) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);

  const addAnimation = useCallback(() => {
    const scroller = scrollerRef.current;
    const container = containerRef.current;
    if (!scroller || !container) return;

    // Duplicate items for seamless loop
    const scrollerContent = Array.from(scroller.children);
    scrollerContent.forEach((item) => {
      const duplicated = item.cloneNode(true) as HTMLElement;
      duplicated.setAttribute("aria-hidden", "true");
      scroller.appendChild(duplicated);
    });

    const durations = { slow: "60s", normal: "35s", fast: "20s" };
    container.style.setProperty("--scroll-duration", durations[speed]);
    container.style.setProperty(
      "--scroll-direction",
      direction === "left" ? "normal" : "reverse",
    );
  }, [direction, speed]);

  useEffect(() => {
    addAnimation();
  }, [addAnimation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex min-w-full shrink-0 gap-4 py-2",
          "animate-[scroll_var(--scroll-duration,35s)_linear_infinite_var(--scroll-direction,normal)]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        style={{ willChange: "transform" }}
      >
        {items.map((item, i) => (
          <li key={i} className="shrink-0">
            {renderItem(item, i)}
          </li>
        ))}
      </ul>

      <style jsx>{`
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-50% - 0.5rem));
          }
        }
      `}</style>
    </div>
  );
}
