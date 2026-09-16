"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * PlaceholdersAndVanishInput — Aceternity-style (§1.3).
 *
 * A textarea/input where the placeholder text (rotating through examples)
 * animates/vanishes upward as the user starts typing. The placeholder returns
 * when the input is empty.
 */
export function PlaceholdersAndVanishInput({
  placeholders,
  value,
  onChange,
  onSubmit,
  className,
  disabled,
  minRows = 3,
}: {
  placeholders: string[];
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
  disabled?: boolean;
  minRows?: number;
}) {
  const reduced = useReducedMotion();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cycle through placeholders
  useEffect(() => {
    if (value.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [placeholders.length, value.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
    },
    [onSubmit],
  );

  const showPlaceholder = value.length === 0;
  const currentPlaceholder = placeholders[placeholderIndex] ?? "";

  return (
    <div className={cn("relative", className)}>
      {/* Animated placeholder */}
      <AnimatePresence mode="wait">
        {showPlaceholder && (
          <motion.span
            key={currentPlaceholder}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 0.40, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-3.5 top-3.5 font-mono text-xs text-fg-dim select-none"
          >
            {currentPlaceholder}
          </motion.span>
        )}
      </AnimatePresence>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        rows={minRows}
        className={cn(
          "w-full resize-none rounded-card border bg-surface-3 p-3.5 font-mono text-xs leading-5 text-fg transition-all",
          "focus-visible:outline-none",
          isFocused
            ? "border-line-strong shadow-glow"
            : "border-line hover:border-line-strong",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      />
    </div>
  );
}
