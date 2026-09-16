"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * 12–16 particle burst for a correct answer (§2.2).
 *
 * Deliberately small and local to the option row — the brief calls for "not
 * full-screen". Particles are absolutely positioned at the row's trailing edge
 * and animate transform + opacity only (compositor-only).
 *
 * Geometry comes from a seeded hash rather than `Math.random()`: randomness
 * during render is impure (and would make the component untestable), while a
 * seed keeps each burst varied but reproducible. Mounting *is* the trigger —
 * the burst renders when a verdict flips to "correct" and plays once.
 * Under `prefers-reduced-motion` nothing renders at all.
 */
const COUNT = 14;

/** Small deterministic hash → [0, 1). */
function unit(seed: number, index: number, salt: number): number {
  let h = (seed * 374761393 + index * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function ParticleBurst({
  seed = 1,
  accent = "success",
}: {
  seed?: number;
  accent?: "success" | "brand";
}) {
  void accent;
  const reduced = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, index) => {
        // Spread evenly around the circle, jittered so it reads organic.
        const angle = (index / COUNT) * Math.PI * 2 + unit(seed, index, 1) * 0.5;
        const distance = 26 + unit(seed, index, 2) * 30;
        return {
          id: index,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 3 + Math.round(unit(seed, index, 3) * 3),
          delay: unit(seed, index, 4) * 0.05,
        };
      }),
    [seed],
  );

  if (reduced) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-6 z-20 h-0 w-0">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          style={{ width: particle.size, height: particle.size }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: particle.x, y: particle.y, scale: 0.3 }}
          transition={{ duration: 0.62, delay: particle.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </span>
  );
}
