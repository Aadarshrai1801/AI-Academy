"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { STAGGER_HERO, textGenerate } from "@/lib/motion";

/**
 * TextGenerateEffect — Aceternity-style (§1.3).
 *
 * Words fade/blur in sequentially as if being "generated." Each word starts
 * blurred and transparent, then sharpens and fades in with a stagger. Perfect
 * for landing hero headlines and AI Tutor response text.
 */
export function TextGenerateEffect({
  words,
  className,
  delay = 0,
  as: Tag = "p",
}: {
  words: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  const wordArray = words.split(" ");

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  if (reduced) {
    return <Tag className={className}>{words}</Tag>;
  }

  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        animate={started ? "show" : "hidden"}
        variants={{
          hidden: {},
          show: { transition: STAGGER_HERO },
        }}
        className="inline"
      >
        {wordArray.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            variants={textGenerate}
            className="inline-block"
          >
            {word}
            {i < wordArray.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  );
}
