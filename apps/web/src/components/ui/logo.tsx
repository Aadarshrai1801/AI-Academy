"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * `<LogoMark>` — the AI Academy brand tile.
 *
 * A gradient tile (indigo → violet → sky) carrying the double-slash mark and
 * an amber "streak" spark. "Dynamic" in two senses:
 *
 * - a sheen sweeps the tile and the spark pulses (pure CSS, no JS per frame),
 * - the mark stays crisp at any size because it is inline SVG.
 *
 * Gradient/clip ids are scoped with `useId()` so multiple marks can render on
 * one page without collisions, and the animation is disabled under
 * `prefers-reduced-motion`.
 */
export interface LogoMarkProps {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
  /** Accessible name. Pass `null` for a decorative mark next to a text label. */
  title?: string | null;
}

export function LogoMark({ size = 28, className, title = "AI Academy" }: LogoMarkProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const scope = `logo-${uid}`;
  const tileId = `${uid}-tile`;
  const washId = `${uid}-wash`;
  const sheenId = `${uid}-sheen`;
  const sparkId = `${uid}-spark`;
  const clipId = `${uid}-clip`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      className={cn(scope, "shrink-0", className)}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={tileId} x1="4" y1="0" x2="60" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id={washId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.30" />
          <stop offset="0.60" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.50" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={sparkId} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FEF3C7" />
          <stop offset="0.55" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
        <clipPath id={clipId}>
          <rect width="64" height="64" rx="15" />
        </clipPath>
      </defs>

      <rect width="64" height="64" rx="15" fill={`url(#${tileId})`} />
      <g clipPath={`url(#${clipId})`}>
        <path d="M -8 64 L 64 -8 L 64 8 L 8 64 Z" fill={`url(#${washId})`} />
        <g transform="rotate(18 32 32)">
          <rect className="sheen" x="-46" y="-30" width="16" height="124" rx="8" fill={`url(#${sheenId})`} />
        </g>
      </g>

      <g stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" fill="none">
        <path d="M 21.5 46 L 33 18" />
        <path d="M 35 46 L 46.5 18" />
      </g>

      <g className="spark">
        <circle cx="50" cy="48" r="7" fill="#F59E0B" opacity="0.35" />
        <circle cx="50" cy="48" r="4.6" fill={`url(#${sparkId})`} />
        <circle cx="50" cy="48" r="1.7" fill="#FFFFFF" opacity="0.9" />
      </g>

      <style>{`
        .${scope} .spark { transform-box: fill-box; transform-origin: center; }
        @media (prefers-reduced-motion: no-preference) {
          .${scope} .sheen { animation: ${scope}-sweep 4.2s ease-in-out infinite; }
          .${scope} .spark { animation: ${scope}-pulse 2.6s ease-in-out infinite; }
        }
        @keyframes ${scope}-sweep {
          0%, 55% { transform: translateX(0); }
          100% { transform: translateX(170px); }
        }
        @keyframes ${scope}-pulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.18); opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
