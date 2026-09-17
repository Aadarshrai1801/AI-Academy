"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * TypewriterEffect — Aceternity-style (§1.3).
 *
 * Types text character by character with a blinking caret. Can cycle through
 * an array of strings (auto-delete and retype). Used for AI Tutor placeholder
 * examples and optionally the marketing hero subhead.
 */
export function TypewriterEffect({
  words,
  className,
  cursorClassName,
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseMs = 2000,
  loop = true,
}: {
  words: string[];
  className?: string;
  cursorClassName?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
  loop?: boolean;
}) {
  const reduced = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const currentWord = words[currentIndex] ?? "";

  const tick = useCallback(() => {
    if (isDeleting) {
      setDisplayText((prev) => prev.slice(0, -1));
      if (displayText.length === 0) {
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % words.length);
      }
    } else {
      setDisplayText(currentWord.slice(0, displayText.length + 1));
    }
  }, [isDeleting, displayText, currentWord, words.length]);

  useEffect(() => {
    if (reduced) return;

    if (!isDeleting && displayText === currentWord) {
      if (!loop && currentIndex === words.length - 1) return;
      const timer = setTimeout(() => setIsDeleting(true), pauseMs);
      return () => clearTimeout(timer);
    }

    const speed = isDeleting ? deletingSpeed : typingSpeed;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentWord, tick, typingSpeed, deletingSpeed, pauseMs, loop, currentIndex, words.length, reduced]);

  if (reduced) {
    return <span className={className}>{currentWord}</span>;
  }

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span>{displayText}</span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className={cn(
          "ml-0.5 inline-block h-[1.1em] w-[2px] bg-brand",
          cursorClassName,
        )}
      />
    </span>
  );
}
