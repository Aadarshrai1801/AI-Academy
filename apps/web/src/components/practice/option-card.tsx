"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckDraw } from "@/components/practice/check-draw";
import { EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * A single answer option — the highest-traffic interactive element in the
 * product (design plan §4.1), so it carries the most craft:
 *
 * - **hover**: surface lightens and a left hairline scales in — no lift.
 * - **select**: ink ring + a 1 → 1.02 → 1 pulse (150ms); ink = action.
 * - **correct**: growth left-edge + soft fill + a self-drawing checkmark.
 *   The reserved accent is the reward; there is no confetti and no shake.
 * - **chosen but wrong**: calm review amber with "Not this one" — a note,
 *   not an alarm. The expected answer is shown in the verdict panel.
 * - **keydown 1–4**: the same ripple a click produces, so keyboard users get
 *   identical feedback.
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
const SELECT_PULSE = { scale: [1, 1.02, 1] };
const AT_REST = { scale: 1 };
/**
 * Springs only support two-keyframe tracks, so the multi-step pulse runs as a
 * short tween; the rest state below still settles on `SPRING.snappy`.
 */
const PULSE_TRANSITION = { duration: 0.15, ease: EASE.outExpo };

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
  const pulsing = !reduced && selected && !settled;

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
      // Pulse on selection only. Wrong answers get language, not shake.
      animate={pulsing ? SELECT_PULSE : AT_REST}
      transition={pulsing ? PULSE_TRANSITION : SPRING.snappy}
      className={cn(
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-work border p-3.5 text-left text-sm transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        !settled &&
          (selected
            ? "border-brand bg-brand-soft text-fg ring-1 ring-brand/30"
            : "border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:bg-surface-3 hover:text-fg"),
        isCorrect && "border-growth/60 bg-growth-soft font-semibold text-fg",
        isWrong && "border-review/50 bg-review-soft text-fg-muted",
        settled && !isCorrect && !isWrong && "border-line bg-surface-1 text-fg-dim opacity-40",
        disabled && "cursor-default",
      )}
    >
      {/* Left edge bar — scales in on hover, solid on select/correct/review. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-0 w-0.5 origin-center rounded-r-full transition-transform duration-150 ease-out",
          isCorrect
            ? "bg-growth"
            : isWrong
              ? "bg-review"
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
            ? "border-growth/60 bg-growth-soft font-bold text-growth-ink"
            : isWrong
              ? "border-line-strong bg-surface-2 text-fg-dim"
              : selected
                ? "border-brand bg-brand font-bold text-on-brand"
                : "border-line-strong bg-surface-2 text-fg-dim group-hover:border-line-strong group-hover:text-fg",
        )}
      >
        {index + 1}
      </span>

      <span className="relative z-10 flex-1 leading-5">{text}</span>

      {/* Verdict affordance — icon + word + hue, never hue alone. */}
      {isCorrect && (
        <span className="relative z-10 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-growth-ink">
          <CheckDraw className="text-growth" />
          {verdict === "revealed" ? "Answer" : "Correct"}
        </span>
      )}
      {isWrong && (
        <span className="relative z-10 shrink-0 text-[11px] font-medium text-review-ink">
          Not this one
        </span>
      )}
    </motion.button>
  );
}
