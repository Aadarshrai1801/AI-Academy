"use client";

import { useEffect, useRef } from "react";

/**
 * Draws a diagram's connectors in on load (§2.2).
 *
 * Instead of hand-authoring stroke animations for all eight diagrams in
 * `question-visual.tsx`, this walks the rendered SVG and animates every
 * `path`/`line`/`polyline` in document order. Two details make it work
 * generically:
 *
 * 1. `pathLength="1"` normalises each element's geometry to a single unit, so
 *    one `stroke-dasharray: 1` fits a 40px arrow and a 300px bezier alike —
 *    no measuring, no `getTotalLength()`.
 * 2. Elements that are *meant* to be dashed (the diagrams use `3 3` for
 *    reference lines) get their inline dash overrides cleared when the
 *    animation ends, so they return to dashed exactly as authored.
 *
 * Stagger is 45ms per edge (~400ms for a 9-edge diagram), and the whole thing
 * is skipped under `prefers-reduced-motion` — connectors simply appear.
 */
export function useDrawInEdges<T extends HTMLElement>(
  deps: unknown[] = [],
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const edges = Array.from(root.querySelectorAll<SVGGeometryElement>("path, line, polyline"));
    if (edges.length === 0) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const cleanups: Array<() => void> = [];

    edges.forEach((edge, index) => {
      edge.setAttribute("pathLength", "1");
      edge.style.strokeDasharray = "1";
      edge.style.strokeDashoffset = "1";
      edge.style.animation = `edge-draw 340ms var(--ease-out-expo) ${index * 45}ms forwards`;

      const finish = () => {
        // Release the inline overrides; attribute-level dashes take over again.
        edge.style.strokeDasharray = "";
        edge.style.strokeDashoffset = "";
        edge.style.animation = "";
      };
      edge.addEventListener("animationend", finish, { once: true });
      cleanups.push(() => {
        edge.removeEventListener("animationend", finish);
        finish();
      });
    });

    // Safety net: if `animationend` never fires (element replaced mid-flight),
    // clear the overrides so connectors cannot get stranded invisible.
    const fallback = window.setTimeout(() => {
      for (const cleanup of cleanups) cleanup();
    }, 400 + edges.length * 45);
    cleanups.push(() => window.clearTimeout(fallback));

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
