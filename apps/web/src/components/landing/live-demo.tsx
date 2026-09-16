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
    tag: "Attention mechanisms // spatial complexity",
    prompt:
      "With query and key tensors of shape [B, H, S, D_k], what is the memory complexity of storing raw unmasked attention weights before softmax?",
    schema: [
      "# Q @ K.transpose(-2, -1)",
      "Query: [B, H, S, D_k]  ×  Keyᵀ: [B, H, D_k, S]",
      "→ attention map [B, H, S, S]",
    ],
    options: ["O(B × H × D_k)", "O(B × H × S²)", "O(B × S × D_k²)", "O(B × H × S × D_k)"],
    correct: 1,
    wrong: 3,
  },
  {
    tag: "Optimization // adaptive moments",
    prompt:
      "In AdamW, what is the purpose of the bias-correction terms applied to the first and second moment estimates?",
    schema: [
      "m_t = β₁·m_(t-1) + (1-β₁)·g_t",
      "v_t = β₂·v_(t-1) + (1-β₂)·g_t²",
      "m̂_t = m_t / (1 - β₁ᵗ)",
    ],
    options: [
      "They decay the learning rate over time",
      "They correct the zero-initialisation bias in early steps",
      "They normalise gradients to unit variance",
      "They prevent weight decay from shrinking moments",
    ],
    correct: 1,
    wrong: 0,
  },
  {
    tag: "Distributed training // communication volume",
    prompt:
      "For ring all-reduce across N GPU workers with a message of size M, what is the communication volume transferred per worker?",
    schema: ["reduce-scatter + all-gather", "N-1 chunks per phase", "Total: 2 · (N-1)/N · M"],
    options: ["2 · (N-1)/N · M", "N · M", "(N-1) · M", "2 · M"],
    correct: 0,
    wrong: 2,
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
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-3" />
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
              workbench — live interactive preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            {QUESTIONS.map((_, index) => (
              <span
                key={index}
                className={
                  index === state.index
                    ? "h-1.5 w-4 rounded-full bg-fg shadow-sm transition-all duration-300"
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
            className="grid gap-6 p-6 lg:grid-cols-12 lg:p-8"
          >
            {/* Specification */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
                <span className="h-1.5 w-1.5 rounded-full bg-fg" />
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
              className="flex flex-col gap-2.5 lg:col-span-5"
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
          <span>Deterministic grading · microsecond latency</span>
          <motion.span
            key={`${state.index}-${state.phase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={SPRING.snappy}
            className="text-fg font-semibold"
          >
            {state.phase === 0 ? "Reading problem…" : state.phase === 1 ? "Option selected…" : "Verdict verified ✓"}
          </motion.span>
        </div>
      </div>
    </ThreeDCard>
  );
}
