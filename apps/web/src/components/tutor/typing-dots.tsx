"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Three-dot "thinking" indicator shown before the first token arrives (§2.4).
 * Staggered opacity only — no layout work, and it disappears entirely under
 * reduced motion (the text "Thinking" carries the meaning instead).
 */
export function TypingDots({ label = "Thinking" }: { label?: string }) {
  const reduced = useReducedMotion();

  return (
    <span className="flex items-center gap-2 text-xs text-fg-muted">
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-fg"
            animate={reduced ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
            transition={
              reduced
                ? undefined
                : { duration: 1.1, repeat: Infinity, delay: index * 0.15, ease: "easeInOut" }
            }
          />
        ))}
      </span>
      <span className="font-mono text-[11px]">{label}…</span>
    </span>
  );
}

/**
 * Simulated token streaming.
 *
 * `/ai/ask` returns the full answer in one response, so there is nothing to
 * stream from the wire — this reveals it at a readable pace instead of
 * dumping a wall of text. Blocks that must render atomically (maths, code)
 * are handled by `RichAnswer`; here we only advance a character budget.
 *
 * `chunk` is sized so a typical 1–2k character answer lands in ~4–8s, which is
 * roughly the pace of a real token stream from this kind of model.
 */
export function useTypewriter(
  text: string | null,
  { enabled = true, chunk = 7, intervalMs = 16 } = {},
): { revealed: number; done: boolean } {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!text || !enabled) return;

    const timer = setInterval(() => {
      setRevealed((prev) => {
        const next = prev + chunk;
        if (next >= text.length) {
          clearInterval(timer);
          return text.length;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text, enabled, chunk, intervalMs]);

  // Derived, never written during render: consumers that need a fresh reveal
  // for a new answer mount a new instance (keyed), so no reset is required.
  const total = text?.length ?? 0;
  return {
    revealed: enabled ? Math.min(revealed, total) : total,
    done: !enabled || revealed >= total,
  };
}
