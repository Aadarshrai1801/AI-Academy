"use client";

import { useEffect, useRef } from "react";
import { RichAnswer } from "@/components/tutor/rich-answer";
import { useTypewriter } from "@/components/tutor/typing-dots";

/**
 * A single assistant answer that streams in.
 *
 * Kept as its own component **on purpose**: it is rendered with a `key` per
 * exchange, so each new answer gets a fresh reveal budget instead of needing to
 * reset state (which would mean writing state during render or in an effect).
 * That keeps `useTypewriter` a clean, lint-friendly timer.
 */
export function StreamingAnswer({ text, stream }: { text: string; stream: boolean }) {
  const { revealed } = useTypewriter(text, { enabled: stream });
  return <RichAnswer text={text} revealChars={stream ? revealed : undefined} />;
}

/**
 * Event-driven typewriter for the example-prompt chips.
 *
 * Chips fill the composer character-by-character to show what a good prompt
 * looks like. Deliberately not an effect: it starts on click, is cancelled by
 * the next click, and clears itself on unmount — so there is no state being
 * written from an effect body at all.
 */
export function useTypeIntoField(intervalMs = 18, chunk = 3) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => stop, []);

  return (full: string, onUpdate: (value: string) => void) => {
    stop();
    let index = 0;
    onUpdate("");
    timer.current = setInterval(() => {
      index += chunk;
      onUpdate(full.slice(0, index));
      if (index >= full.length) stop();
    }, intervalMs);
  };
}
