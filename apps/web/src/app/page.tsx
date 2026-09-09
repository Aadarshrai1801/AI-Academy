"use client";

import { useState } from "react";
import Link from "next/link";

const pillars = [
  {
    icon: "⚡",
    tag: "PARAMETER BANK",
    title: "Continuous Synthesis",
    body: "Curated problem sets supplemented by background LLM generation with vector embedding deduplication across PyTorch, CUDA, and loss mechanics.",
  },
  {
    icon: "🏆",
    tag: "RANKING ARCHITECTURE",
    title: "Daily Epoch Leaderboard",
    body: "Fair, microsecond grading recorded in Redis sorted sets. Strict 00:00 UTC resets, tie-break velocity analytics, and public ranking.",
  },
  {
    icon: "🔥",
    tag: "STATE RETENTION",
    title: "Deterministic Streaks",
    body: "Idempotent streak verification with grace windows, milestone velocity multipliers, and auto-banking freeze protection for Pro members.",
  },
  {
    icon: "🎬",
    tag: "ASYNC REASONING",
    title: "AI Video Synthesis",
    body: "Sub-second LaTeX mathematical derivations backed by asynchronous worker queues compiling multi-slide visual explainer videos.",
  },
];

const curriculumTracks = [
  {
    title: "Transformers & Attention Mechanics",
    description: "QKV tensor projections, Scaled Dot-Product complexity, causal masking, FlashAttention, and Rotary Embeddings.",
    badge: "Most Popular",
    modules: ["Self-Attention Complexity", "KV Cache Sizing", "Multi-Query Attention"],
  },
  {
    title: "Distributed Training & Scaling",
    description: "Data parallelism, FSDP, 3D tensor parallelism, Pipeline stages, and NCCL Ring All-Reduce communication volume.",
    badge: "Production Tier",
    modules: ["Ring All-Reduce", "ZeRO Memory Stages", "Gradient Synchronization"],
  },
  {
    title: "GPU Systems & CUDA Kernels",
    description: "Shared memory banking, warp divergence, tensor cores, memory coalescence, and Triton kernel optimizations.",
    badge: "Hardware Focus",
    modules: ["Warp Execution", "SRAM vs HBM Bandwidth", "Kernel Fusion"],
  },
  {
    title: "Loss Surfaces & Optimization",
    description: "AdamW update equations, second-moment bias correction, gradient clipping, RMSNorm, and learning rate schedules.",
    badge: "Core Foundations",
    modules: ["Adam Optimizer Math", "RMSNorm Derivations", "Loss Landscape Saddles"],
  },
  {
    title: "Mathematical Foundations & Stats",
    description: "Gaussian normal distributions, confidence intervals, Bayes theorem, hypothesis testing, and matrix calculus.",
    badge: "Analytical Depth",
    modules: ["Bayes Posterior Updates", "Heteroscedasticity", "P-Value Interpretations"],
  },
  {
    title: "Inference & Quantization",
    description: "FP8, INT4 weight-only quantization, speculative decoding, continuous batching, and vLLM PagedAttention.",
    badge: "Deployment Edge",
    modules: ["PagedAttention Mechanics", "Quantization Noise", "Speculative Drafting"],
  },
];

export default function Home() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const sampleOptions = [
    "O(B × H × D_k)",
    "O(B × H × S²)",
    "O(B × S × D_k²)",
    "O(B × H × S × D_k)",
  ];

  const handleOptionClick = (index: number) => {
    if (hasSubmitted) return;
    setSelectedOption(index);
  };

  const handleDemoSubmit = () => {
    if (selectedOption === null) return;
    setHasSubmitted(true);
  };

  const handleResetDemo = () => {
    setSelectedOption(null);
    setHasSubmitted(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:px-8 sm:py-16">
      {/* Hero Section */}
      <section className="flex flex-col items-start gap-6 border-b border-[var(--seam)] pb-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--seam)] bg-[var(--chassis)] px-3.5 py-1 text-xs font-mono text-[var(--ink-lead)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tungsten)] animate-pulse" />
          <span>PRODUCTION-GRADE MACHINE LEARNING PRACTICE</span>
        </div>

        <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-5xl sm:leading-[1.12]">
          The practice ground for engineers who{" "}
          <span className="text-[var(--tungsten)]">build models</span>, not just prompt them.
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-[var(--ink-lead)] sm:text-base">
          Daily deliberate practice across backpropagation, transformer attention mechanics, GPU kernels, and distributed training. Compete on the daily epoch leaderboard and accelerate intuition with on-demand AI reasoning.
        </p>

        <div className="flex flex-wrap items-center gap-3.5 pt-2">
          <Link
            href="/practice"
            className="flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-6 py-3 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 shadow-[0_0_20px_rgba(229,133,55,0.25)]"
          >
            <span>Launch Practice Workbench</span>
            <span>→</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 rounded-md border border-[var(--seam)] bg-[var(--chassis)] px-6 py-3 font-mono text-xs font-medium text-[var(--ink-chalk)] transition-colors hover:border-[var(--seam-highlight)]"
          >
            <span>View Leaderboard</span>
          </Link>
          <a
            href="#curriculum"
            className="flex items-center gap-2 rounded-md border border-transparent px-4 py-3 font-mono text-xs font-medium text-[var(--ink-lead)] transition-colors hover:text-[var(--ink-chalk)]"
          >
            <span>Explore Tracks ↓</span>
          </a>
        </div>

        {/* Micro Telemetry Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-[var(--ink-lead)] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--converged)]">✓</span>
            <span>100% Free Daily Tier</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--converged)]">✓</span>
            <span>PyTorch 2.5 & CUDA 12.4</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--converged)]">✓</span>
            <span>Zero Prompt Engineering Fluff</span>
          </div>
        </div>
      </section>

      {/* Interactive Workbench Teaser Frame */}
      <section className="mt-14 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3 font-mono text-xs text-[var(--ink-lead)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--diverged)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--tungsten)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--converged)]" />
            <span className="ml-2">interactive_demo.py</span>
          </div>
          <span className="rounded bg-[var(--tungsten)]/10 px-2 py-0.5 text-[var(--tungsten)]">
            LIVE SAMPLE PROBLEM
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left specification */}
          <div className="lg:col-span-7">
            <div className="font-mono text-xs text-[var(--tungsten)]">
              ATTENTION MECHANISMS // SPATIAL COMPLEXITY
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink-chalk)]">
              In Multi-Head Attention with query tensor of shape <code className="font-mono text-[var(--tungsten)]">[B, H, S, D_k]</code> and key tensor of shape <code className="font-mono text-[var(--tungsten)]">[B, H, S, D_k]</code>, what is the spatial memory complexity of storing raw unmasked attention weights prior to softmax?
            </p>

            {/* Architecture Context Schema */}
            <div className="mt-4 rounded border border-[var(--seam)] bg-[var(--substrate)] p-3.5 font-mono text-xs text-[var(--ink-lead)]">
              <div className="text-[var(--ink-chalk)] font-semibold"># Tensor operation: Q @ K.transpose(-2, -1)</div>
              <div className="mt-1 text-[var(--ink-lead)]">Query: [B, H, S, D_k] × Key^T: [B, H, D_k, S]</div>
              <div className="mt-2 text-[var(--converged)]">
                Output shape: [B, H, S, S] → Memory scale: O(B × H × S²)
              </div>
            </div>

            {hasSubmitted && (
              <div className={`mt-4 rounded border p-3 font-mono text-xs ${
                selectedOption === 1
                  ? "border-[var(--converged)]/40 bg-[var(--converged)]/10 text-[var(--converged)]"
                  : "border-[var(--diverged)]/40 bg-[var(--diverged)]/10 text-[var(--diverged)]"
              }`}>
                {selectedOption === 1 ? (
                  <div>
                    <strong className="font-bold">✓ Accurate! +10 pts awarded.</strong>
                    <p className="mt-1 text-[11px] text-[var(--ink-chalk)]">
                      The dot product of each query token with all key tokens produces an S×S pairwise matrix for each head across the batch.
                    </p>
                  </div>
                ) : (
                  <div>
                    <strong className="font-bold">✕ Diverged. Correct answer is O(B × H × S²).</strong>
                    <p className="mt-1 text-[11px] text-[var(--ink-chalk)]">
                      D_k is contracted in the inner product, leaving sequence length squared S².
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right interactive options */}
          <div className="flex flex-col justify-between gap-3 lg:col-span-5">
            <div className="flex flex-col gap-2">
              {sampleOptions.map((opt, i) => {
                const isSelected = selectedOption === i;
                const isCorrect = i === 1;
                let borderClass = "border-[var(--seam)] bg-[var(--panel)] text-[var(--ink-lead)]";

                if (hasSubmitted) {
                  if (isCorrect) borderClass = "border-[var(--converged)] bg-[var(--converged)]/10 text-[var(--ink-chalk)]";
                  else if (isSelected) borderClass = "border-[var(--diverged)] bg-[var(--diverged)]/10 text-[var(--diverged)]";
                } else if (isSelected) {
                  borderClass = "border-[var(--tungsten)] bg-[var(--tungsten)]/10 text-[var(--ink-chalk)]";
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleOptionClick(i)}
                    className={`flex items-center gap-3 rounded border p-3 font-mono text-xs text-left transition-all hover:border-[var(--seam-highlight)] ${borderClass}`}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-[var(--seam-highlight)] text-[10px]">
                      {i + 1}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--seam)] pt-3">
              {!hasSubmitted ? (
                <button
                  type="button"
                  onClick={handleDemoSubmit}
                  disabled={selectedOption === null}
                  className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-1.5 font-mono text-xs font-semibold text-black hover:opacity-90 disabled:opacity-40"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="rounded-md border border-[var(--seam)] bg-[var(--panel)] px-4 py-1.5 font-mono text-xs text-[var(--ink-chalk)] hover:border-[var(--seam-highlight)]"
                >
                  Try Again
                </button>
              )}

              <Link
                href="/practice"
                className="font-mono text-xs text-[var(--tungsten)] hover:underline"
              >
                Open Full Workbench →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Grid */}
      <section id="features" className="mt-16">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span className="text-[var(--tungsten)]">//</span>
          <span>PLATFORM CAPABILITIES</span>
        </div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Engineered for Deep Mathematical & Systems Retention
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6 transition-colors hover:border-[var(--seam-highlight)]"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{p.icon}</span>
                <span className="font-mono text-[10px] text-[var(--tungsten)]">{p.tag}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-[var(--ink-chalk)]">{p.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-lead)]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum Tracks */}
      <section id="curriculum" className="mt-16">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span className="text-[var(--tungsten)]">//</span>
          <span>CORE CURRICULUM</span>
        </div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          From Attention Tensors to CUDA Kernels
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-lead)] max-w-2xl">
          Progressive problem sets spanning modern foundation model architecture, low-level GPU memory mechanics, and distributed scaling.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curriculumTracks.map((track) => (
            <div
              key={track.title}
              className="flex flex-col justify-between rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5 transition-colors hover:border-[var(--seam-highlight)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[var(--panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--tungsten)]">
                    {track.badge}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--ink-chalk)]">
                  {track.title}
                </h3>
                <p className="mt-1.5 text-xs text-[var(--ink-lead)] leading-relaxed">
                  {track.description}
                </p>
              </div>

              <div className="mt-4 border-t border-[var(--seam)] pt-3">
                <div className="font-mono text-[10px] text-[var(--ink-dim)] uppercase">Sample Modules:</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {track.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-[var(--substrate)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-chalk)]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom High-Impact CTA Banner */}
      <section className="mt-16 rounded-xl border border-[var(--tungsten)]/40 bg-gradient-to-br from-[var(--chassis)] to-[var(--panel)] p-8 text-center sm:p-12 shadow-[0_0_30px_rgba(229,133,55,0.08)]">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Ready to test your machine learning depth?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-[var(--ink-lead)] leading-relaxed">
          Free tier includes 10 questions daily, full streak continuity, and public ranking. No credit card required.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/practice"
            className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-8 py-3 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 shadow-[0_0_16px_rgba(229,133,55,0.3)]"
          >
            Start Free Practice
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-md border border-[var(--seam)] bg-[var(--panel)] px-6 py-3 font-mono text-xs font-medium text-[var(--ink-chalk)] hover:border-[var(--seam-highlight)]"
          >
            View Global Rankings
          </Link>
        </div>
      </section>
    </main>
  );
}
