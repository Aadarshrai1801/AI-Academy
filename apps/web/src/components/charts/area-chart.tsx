"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * `<AreaChart>` — animated single-series area chart (§2.7).
 *
 * Built as plain SVG rather than pulling in a charting library: this is one
 * series with one interaction, and a library would ship ~90KB while fighting
 * the design tokens for control of strokes, gradients and hover states.
 *
 * What it does:
 * - **draws in on mount** via `pathLength` normalisation (no geometry
 *   measuring), with the gradient fill fading in behind it
 * - **hover** shows a crosshair, a highlighted point and a value tooltip,
 *   snapping to the nearest sample
 * - **keyboard** is a first-class path (§4): the plot is focusable and
 *   `←/→/Home/End` walk the series, announcing each point to screen readers
 * - renders nothing until measured, so it is SSR-safe and cannot shift layout
 *
 * Deliberately linear, not smoothed: daily scores are spiky, and a spline
 * would draw a curve through data that never happened.
 */
export interface AreaPoint {
  /** ISO day used for the axis label / tooltip. */
  day: string;
  value: number;
}

export interface AreaChartProps {
  points: AreaPoint[];
  height?: number;
  /** Accessible description of the series. */
  label: string;
  valueSuffix?: string;
  className?: string;
}

const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PAD_RIGHT = 6;

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AreaChart({
  points,
  height = 200,
  label,
  valueSuffix = " pts",
  className,
}: AreaChartProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Measure the container so hover maps to real pixels.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(next);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;
    const plotWidth = Math.max(width - PAD_RIGHT, 1);
    const plotHeight = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);
    const max = Math.max(...points.map((p) => p.value), 1);
    const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
      x: points.length > 1 ? index * step : plotWidth / 2,
      y: PAD_TOP + plotHeight - (point.value / max) * plotHeight,
      ...point,
    }));

    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const area =
      coords.length > 0
        ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD_TOP + plotHeight} L ${coords[0].x.toFixed(1)} ${PAD_TOP + plotHeight} Z`
        : "";

    return { coords, line, area, plotHeight, max, plotWidth };
  }, [width, height, points]);

  const handlePointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!geometry) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      // Snap to the nearest sample.
      let nearest = 0;
      let bestDistance = Infinity;
      geometry.coords.forEach((coord, index) => {
        const distance = Math.abs(coord.x - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = index;
        }
      });
      setActiveIndex(nearest);
    },
    [geometry],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (points.length === 0) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((current) => {
          const base = current ?? (event.key === "ArrowRight" ? -1 : points.length);
          const next = event.key === "ArrowRight" ? base + 1 : base - 1;
          return Math.min(Math.max(next, 0), points.length - 1);
        });
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(points.length - 1);
      } else if (event.key === "Escape") {
        setActiveIndex(null);
      }
    },
    [points.length],
  );

  const active = activeIndex !== null ? geometry?.coords[activeIndex] : undefined;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const summary = `${label}: ${points.length} days, ${total}${valueSuffix} total. Highest ${Math.max(
    ...points.map((p) => p.value),
    0,
  )}${valueSuffix}.`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="img"
      aria-label={summary}
      onKeyDown={handleKeyDown}
      onBlur={() => setActiveIndex(null)}
      className={cn("relative w-full outline-none focus-visible:ring-2 focus-visible:ring-brand/60", className)}
      style={{ height }}
    >
      {geometry && (
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Baseline */}
          <line
            x1={0}
            y1={PAD_TOP + geometry.plotHeight}
            x2={geometry.plotWidth}
            y2={PAD_TOP + geometry.plotHeight}
            stroke="var(--line)"
            strokeWidth={1}
          />

          <motion.path
            d={geometry.area}
            fill="url(#area-fill)"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: reduced ? 0 : 0.25 }}
          />

          <motion.path
            d={geometry.line}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ strokeDasharray: 1 }}
          />

          {/* Crosshair + highlighted point */}
          {active && (
            <>
              <line
                x1={active.x}
                y1={PAD_TOP}
                x2={active.x}
                y2={PAD_TOP + geometry.plotHeight}
                stroke="var(--line-strong)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <motion.circle
                cx={active.x}
                cy={active.y}
                r={5}
                fill="var(--surface-2)"
                stroke="var(--brand)"
                strokeWidth={2.5}
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              />
            </>
          )}

          {/* Axis endpoints only — enough orientation without a grid of ticks. */}
          <text x={0} y={height - 6} fill="var(--fg-dim)" fontSize={10} fontFamily="var(--font-mono)">
            {formatDay(points[0].day)}
          </text>
          {points.length > 1 && (
            <text
              x={geometry.plotWidth}
              y={height - 6}
              textAnchor="end"
              fill="var(--fg-dim)"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {formatDay(points[points.length - 1].day)}
            </text>
          )}
        </svg>
      )}

      {/* Tooltip */}
      {active && geometry && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface-4 px-2.5 py-1.5 shadow-pop"
          style={{
            // Clamp inside the plot so the tooltip never clips at the edges.
            left: Math.min(Math.max(active.x, 58), Math.max(width - 58, 58)),
            top: Math.max(active.y - 48, 0),
          }}
        >
          <div className="font-mono text-[10px] whitespace-nowrap text-fg-dim">{formatDay(active.day)}</div>
          <div className="font-mono text-xs font-semibold whitespace-nowrap text-fg tabular-nums">
            {active.value}
            {valueSuffix}
          </div>
        </motion.div>
      )}

      {/* Screen-reader announcement for keyboard scrubbing. */}
      <span aria-live="polite" className="sr-only">
        {active ? `${formatDay(active.day)}: ${active.value}${valueSuffix}` : ""}
      </span>
    </div>
  );
}
