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
    tag: "Vision // Representation Learning",
    prompt:
      "Why does a convolutional network generalize to images it never saw during training?",
    schema: [
      "Input: [H × W × C]",
      "Learned filters: [3 × 3 × C → K]",
      "→ Prediction: softmax over K classes",
    ],
    options: [
      "It learns reusable local features rather than memorizing images",
      "It stores a compressed copy of every training image",
      "It interpolates between the exact pixels it was trained on",
      "It re-runs the same forward pass on the test set first",
    ],
    correct: 0,
    wrong: 1,
  },
  {
    tag: "Learning Science // Spaced Repetition",
    prompt:
      "Why does distributed practice outperform massed practice for long-term retention?",
    schema: [
      "Attempt → gap grows with time",
      "Re-attempt near the forgetting curve",
      "→ Retention: +2.4× at 30 days",
    ],
    options: [
      "Each retrieval attempt strengthens the memory trace and extends its half-life",
      "Repeated exposure raises the model's parameter count",
      "Massed practice lowers the signal-to-noise ratio of each session",
      "It works only when the material is already mastered",
    ],
    correct: 0,
    wrong: 2,
  },
  {
    tag: "RL // Policy Optimization",
    prompt:
      "How does an agent learn a navigation policy without hand-coded rules?",
    schema: [
      "Sample trajectory: (s, a, r)",
      "Objective: maximize E[Σ γᵗrₜ]",
      "→ Policy updated: π → π′",
    ],
    options: [
      "By optimizing parameters against the expected discounted return",
      "By enumerating every path and hard-coding the shortest one",
      "By requesting a labelled demonstration for every state",
      "By increasing the exploration temperature until the reward is maximal",
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
              Live Preview — Production Question Bank
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
