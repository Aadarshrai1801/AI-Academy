"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { OptionCard, type OptionVerdict } from "@/components/practice/option-card";
import { ThreeDCard } from "@/components/ui/aceternity/3d-card";
import { EASE, SPRING } from "@/lib/motion";

interface DemoQuestion {
  tag: string;
  prompt: string;
  schema: string[];
  options: string[];
  correct: number;
  wrong: number;
}

const QUESTIONS: DemoQuestion[] = [
  {
    tag: "Smart Computers // Picture Recognition",
    prompt:
      "How does a smart computer tell the difference between a cat and a dog in a photo?",
    schema: [
      "Photo Input: [Colors, Pixels]",
      "Scan features: [Pointy Ears, Whiskers]",
      "→ Prediction: 99% Cat 🐱",
    ],
    options: [
      "By checking pixel patterns and shapes",
      "By sniffing the computer screen",
      "By guessing randomly every time",
      "By asking another pet",
    ],
    correct: 0,
    wrong: 1,
  },
  {
    tag: "Learning Tricks // Practice & Memory",
    prompt:
      "Why is practicing a little bit every day the best way to get super smart at coding and puzzles?",
    schema: [
      "Day 1: Learn new puzzle",
      "Day 2: Remember and repeat",
      "→ Result: Super strong memory!",
    ],
    options: [
      "It helps your brain remember and builds confidence",
      "It makes the computer run out of battery",
      "It changes the color of your room",
      "It makes keyboards turn purple",
    ],
    correct: 0,
    wrong: 2,
  },
  {
    tag: "Robot Brains // Game Playing",
    prompt:
      "How does an AI robot learn to navigate a maze without bumping into walls?",
    schema: [
      "Maze Sensor: [Left, Right, Forward]",
      "Rule: Avoid walls & find the star",
      "→ High Score: Maze Solved! ⭐",
    ],
    options: [
      "By testing directions and learning from mistakes",
      "By walking straight through brick walls",
      "By taking a long nap in the maze",
      "By waiting for the maze to disappear",
    ],
    correct: 0,
    wrong: 1,
  },
];

const PHASE_MS = 1900;

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ index: 0, phase: reduced ? 2 : 0 });

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setState((prev) =>
        prev.phase < 2
          ? { index: prev.index, phase: prev.phase + 1 }
          : { index: (prev.index + 1) % QUESTIONS.length, phase: 0 },
      );
    }, PHASE_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  const question = QUESTIONS[state.index];
  const selectedIndex =
    state.phase === 0 ? null : state.phase === 1 ? question.wrong : question.correct;

  function verdictFor(index: number): OptionVerdict {
    if (state.phase < 2) return "idle";
    if (index === question.correct) return "correct";
    if (index === selectedIndex) return "incorrect";
    return "idle";
  }

  return (
    <ThreeDCard maxTilt={4} className="w-full">
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-[0_20px_50px_rgba(24,24,27,0.16)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
              Live Preview — Real Practice Puzzles
            </span>
          </div>
          <div className="flex items-center gap-2">
            {QUESTIONS.map((_, index) => (
              <span
                key={index}
                className={
                  index === state.index
                    ? "h-1.5 w-4 rounded-full bg-brand shadow-sm transition-all duration-300"
                    : "h-1.5 w-1.5 rounded-full bg-line-strong transition-all duration-300"
                }
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.index}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.32, ease: EASE.outExpo }}
            className="grid gap-6 p-6 lg:grid-cols-2 lg:p-8"
          >
            {/* Specification */}
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                <span>{question.tag}</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed font-medium text-fg sm:text-base">{question.prompt}</p>

              <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4 font-mono text-xs leading-6 text-[var(--fg-muted)]">
                {question.schema.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>

            {/* Options — the real Practice component */}
            <div
              className="flex flex-col gap-2.5"
              role="radiogroup"
              aria-label="Answer options preview"
            >
              {question.options.map((option, index) => (
                <OptionCard
                  key={`${state.index}-${option}`}
                  index={index}
                  text={option}
                  selected={selectedIndex === index}
                  verdict={verdictFor(index)}
                  disabled
                  onSelect={() => undefined}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2.5 font-mono text-[10px] text-[var(--fg-dim)]">
          <span>Instant scoring · daily leaderboard</span>
          <motion.span
            key={`${state.index}-${state.phase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={SPRING.snappy}
            className="text-fg font-semibold"
          >
            {state.phase === 0 ? "Reading problem…" : state.phase === 1 ? "Option selected…" : "Answer checked ✓"}
          </motion.span>
        </div>
      </div>
    </ThreeDCard>
  );
}
