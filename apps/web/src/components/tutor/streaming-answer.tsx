"use client";

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
