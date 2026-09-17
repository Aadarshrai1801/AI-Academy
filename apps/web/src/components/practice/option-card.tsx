"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckDraw } from "@/components/practice/check-draw";
import { ParticleBurst } from "@/components/practice/particle-burst";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * A single answer option (§2.2) — the highest-traffic interactive element in
 * the product, so it carries the most craft:
 *
 * - **hover**: surface lightens and a left accent bar scales in from 0
 * - **select**: accent ring + a 1 → 1.02 → 1 pulse (150ms)
 * - **submit, correct**: emerald flash, self-drawing checkmark, particle burst
 * - **submit, chosen but wrong**: one horizontal shake (±4px, 200ms), rose tint
 * - **submit, the actual answer**: emerald highlight so the user learns it
 *   immediately even when they got it wrong
 * - **keydown 1–4**: the same ripple a click produces, so keyboard users get
 *   identical feedback
 *
 * Verdicts always pair colour with an icon and a text label — colour is never
 * the only signal (§4).
 */
export type OptionVerdict = "correct" | "incorrect" | "revealed" | "idle";

/**
 * Keyframes hoisted to module scope: Framer Motion compares the `animate`
 * target by value, but passing a fresh array literal on every render is a
 * known way to accidentally restart an animation. Constants remove the risk.
 */
const SHAKE_X = { x: [0, -4, 4, -4, 4, 0] };
const SELECT_PULSE = { scale: [1, 1.02, 1] };
const AT_REST = { x: 0, scale: 1 };

export interface OptionCardProps {
  index: number;
  text: string;
  selected: boolean;
  verdict: OptionVerdict;
  disabled?: boolean;
  /** Bumped when the matching number key is pressed; replays the ripple. */
  rippleKey?: number;
  onSelect: () => void;
}

export function OptionCard({
  index,
  text,
  selected,
  verdict,
  disabled = false,
  rippleKey = 0,
  onSelect,
}: OptionCardProps) {
  const reduced = useReducedMotion();

  const isCorrect = verdict === "correct" || verdict === "revealed";
  const isWrong = verdict === "incorrect";
  const settled = verdict !== "idle";

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
      // Shake horizontally once on a wrong answer; spring-pulse on selection.
      animate={
        reduced
          ? undefined
          : isWrong
            ? SHAKE_X
            : selected && !settled
              ? SELECT_PULSE
              : AT_REST
      }
      transition={
        isWrong
          ? { duration: 0.2, ease: "easeInOut" }
          : { ...SPRING.snappy, duration: 0.15 }
      }
      whileHover={reduced || disabled ? undefined : { y: -1 }}
      className={cn(
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-card border p-3.5 text-left text-xs transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        !settled &&
          (selected
            ? "border-brand bg-brand-soft text-fg shadow-sm ring-1 ring-brand/30"
            : "border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:bg-surface-3 hover:text-fg shadow-xs"),
        isCorrect && "border-success/60 bg-state-positive-soft text-fg font-semibold shadow-sm",
        isWrong && "border-dashed border-error/50 bg-state-negative-soft text-fg-muted",
        settled && !isCorrect && !isWrong && "border-line bg-surface-1 text-fg-dim opacity-40",
        disabled && "cursor-default",
      )}
    >
      {/* Left accent bar — scales in on hover, solid when selected/correct. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-0 w-0.5 origin-center rounded-r-full transition-transform duration-150 ease-out",
          isCorrect
            ? "bg-success"
            : isWrong
              ? "bg-error/50"
              : selected
                ? "bg-brand"
                : "bg-brand/40",
          selected || settled ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100",
        )}
      />

      {/* Keyboard-ripple: identical feedback for `1`–`4` presses. */}
      {rippleKey > 0 && !reduced && (
        <motion.span
          key={rippleKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-card bg-brand/5"
          initial={{ opacity: 0.9, scale: 0.98 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {/* Answer key badge */}
      <span
        className={cn(
          "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold transition-colors",
          isCorrect
            ? "border-success/60 bg-state-positive-soft text-state-positive-ink font-bold shadow-xs"
            : isWrong
              ? "border-line-strong bg-surface-2 text-fg-dim"
              : selected
                ? "border-brand bg-brand text-on-brand font-bold shadow-xs"
                : "border-line-strong bg-surface-2 text-fg-dim group-hover:border-line-strong group-hover:text-fg",
        )}
      >
        {index + 1}
      </span>

      <span className="relative z-10 flex-1 leading-5">{text}</span>

      {/* Verdict affordance */}
      {isCorrect && (
        <span className="relative z-10 flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold tracking-wide text-state-positive-ink">
          <CheckDraw className="text-success" />
          {verdict === "revealed" ? "Answer" : "Correct"}
        </span>
      )}
      {isWrong && (
        <span className="relative z-10 shrink-0 font-mono text-[10px] font-semibold text-state-negative-ink">
          Not this one
        </span>
      )}

      {/* Mounting is the trigger: plays once when the verdict turns correct. */}
      {verdict === "correct" && <ParticleBurst seed={index + 1} />}
    </motion.button>
  );
}
