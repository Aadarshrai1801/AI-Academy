"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Layers,
  Network,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { HeroMesh } from "@/components/landing/hero-mesh";
import { LiveDemo } from "@/components/landing/live-demo";
import { Magnetic } from "@/components/landing/magnetic";
import { PricingTiers } from "@/components/landing/pricing-tiers";
import { Reveal, StaggeredHeadline } from "@/components/landing/reveal";
import { ArchitecturePlayground } from "@/components/landing/architecture-playground";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

const TELEMETRY = [
  "Free daily practice",
  "Fresh questions every day",
  "Learn by doing, not watching",
];

const CURRICULUM = [
  {
    tier: "Tier 01",
    title: "Transformers & Attention",
    description: "How attention really works: queries, keys, values, masking, and the tricks that make it fast.",
    modules: ["Self-Attention Complexity", "KV Cache Sizing", "Multi-Query Attention", "Rotary Embeddings"],
    icon: Layers,
  },
  {
    tier: "Tier 02",
    title: "Distributed Training & Scaling",
    description: "How to split models across GPUs and keep them in sync while training at scale.",
    modules: ["Ring All-Reduce", "ZeRO Memory Stages", "Gradient Sync", "Pipeline Bubble Ratios"],
    icon: Network,
  },
  {
    tier: "Tier 03",
    title: "GPU Systems & CUDA Kernels",
    description: "How GPUs actually run your code: memory, threads, and writing faster kernels.",
    modules: ["Warp Execution", "SRAM vs HBM Bandwidth", "Kernel Fusion", "Triton JIT Compiles"],
    icon: Cpu,
  },
  {
    tier: "Tier 04",
    title: "Loss Surfaces & Optimization",
    description: "How optimizers update weights: AdamW, normalization, and learning-rate schedules.",
    modules: ["Adam Optimizer Math", "RMSNorm Derivations", "Loss Landscape Saddles", "Decoupled Weight Decay"],
    icon: Zap,
  },
];

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/practice");
  }, [isLoaded, isSignedIn, router]);

  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-fg" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-24 sm:px-8">
      {/* ── Asymmetric Hero Section (7:5 Split) ─────────────────────────── */}
      <section className="relative pt-12 pb-16 sm:pt-20">
        <HeroMesh />

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Column: Technical Proposition (7 cols) */}
          <div className="flex flex-col lg:col-span-7">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/80 px-3.5 py-1 font-mono text-[11px] text-fg-muted backdrop-blur shadow-glow">
                <span className="relative grid h-1.5 w-1.5 place-items-center">
                  <span className="absolute h-1.5 w-1.5 rounded-full bg-success shadow-glow" />
                  <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-success opacity-75" />
                </span>
                Daily practice for ML engineers
              </div>
            </Reveal>

            <StaggeredHeadline
              className="mt-6 text-3xl font-bold tracking-tight text-fg sm:text-5xl lg:text-6xl sm:leading-[1.08]"
              lines={[
                { text: "The practice ground for engineers" },
                { text: "who build models,", accent: true },
                { text: "not just prompt them." },
              ]}
            />

            <Reveal delay={0.18}>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base">
                Short daily practice across transformers, distributed training, GPU systems, and
                optimization — with a leaderboard that keeps you coming back.
              </p>
            </Reveal>

            <Reveal delay={0.26}>
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Magnetic>
                  <Link
                    href="/sign-up"
                    className="flex items-center gap-2 rounded-xl border border-brand bg-brand px-6 py-3 font-mono text-xs font-semibold text-on-brand shadow-glow-strong transition-all hover:bg-brand-strong"
                  >
                    <span>Start practising free</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    href="/sign-in"
                    className="rounded-xl border border-line-strong bg-surface-2 px-6 py-3 font-mono text-xs font-medium text-fg transition-all hover:border-brand/40 hover:bg-surface-3"
                  >
                    Sign in
                  </Link>
                </Magnetic>
              </div>
            </Reveal>

            <Reveal delay={0.34}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-fg-dim">
                {TELEMETRY.map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right Column: Live Interactive 3D Product Workbench (5 cols) */}
          <div className="flex flex-col lg:col-span-5">
            <Reveal delay={0.2}>
              <div className="relative">
                {/* Glow backdrop behind preview */}
                <div className="absolute -inset-4 rounded-3xl bg-radial from-brand/10 to-transparent blur-2xl" />
                <div className="relative">
                  <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    <span>Live preview</span>
                    <span className="flex items-center gap-1 text-fg">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Try choosing an answer
                    </span>
                  </div>
                  <LiveDemo />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Interactive Architecture & Systems Playground ─────────────── */}
      <ArchitecturePlayground />

      {/* ── Asymmetric Bento Grid Capabilities ───────────────────────── */}
      <section id="features" className="mt-28 scroll-mt-24">
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            How it works
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-fg sm:text-4xl">
            Built to make knowledge stick
          </h2>
          <p className="mt-2 max-w-xl text-xs text-fg-muted sm:text-sm">
            Stop re-reading tutorials. Answer questions, get instant feedback, and actually
            remember the math.
          </p>
        </div>

        {/* Asymmetric Bento Layout: 1 double-width + 2 single + 1 double-width */}
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Tile 1: Double Width Hero Card (7 cols) */}
          <div className="md:col-span-7">
            <CardSpotlight className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg">
                      <Zap className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg">
                      Fresh questions
                    </span>
                  </div>
                  <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 font-mono text-[9px] text-fg-dim">
                    New every day
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-fg">Endless practice questions</h3>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  Start from a curated bank, then get new questions generated every day — no
                  repeats, no stale problem sets.
                </p>
              </div>

              {/* Graphical Visualizer preview inside card */}
              <div className="mt-6 rounded-lg border border-line bg-surface-1 p-3 font-mono text-[10px]">
                <div className="flex items-center justify-between text-fg-dim">
                  <span>New questions</span>
                  <span className="text-fg">No repeats</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
                  <div className="h-full w-4/5 rounded-full bg-brand" />
                </div>
              </div>
            </CardSpotlight>
          </div>

          {/* Tile 2: Standard Card (5 cols) */}
          <div className="md:col-span-5">
            <CardSpotlight className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg">
                      Leaderboard
                    </span>
                  </div>
                  <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 font-mono text-[9px] text-fg-dim">
                    Daily reset
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-fg">Daily leaderboard</h3>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  Answers are scored instantly. The board resets every midnight UTC, and ties
                  break on speed and accuracy.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-lg border border-line bg-surface-1 px-3 py-2 font-mono text-[11px]">
                <span className="text-fg-dim">Next Reset:</span>
                <span className="font-semibold text-fg">00:00:00 UTC</span>
              </div>
            </CardSpotlight>
          </div>

          {/* Tile 3: Standard Card (5 cols) */}
          <div className="md:col-span-5">
            <CardSpotlight className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg">
                      Daily habit
                    </span>
                  </div>
                  <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 font-mono text-[9px] text-fg-dim">
                    Multipliers
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-fg">Build a streak</h3>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  Practice daily to grow your streak. Miss a day and a streak freeze can save it —
                  consistency earns bonus multipliers.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div
                    key={day}
                    className="h-6 flex-1 rounded bg-surface-3 text-center font-mono text-[9px] leading-6 text-fg-dim"
                  >
                    {day}d
                  </div>
                ))}
              </div>
            </CardSpotlight>
          </div>

          {/* Tile 4: Double Width Card (7 cols) */}
          <div className="md:col-span-7">
            <CardSpotlight className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg">
                      <Layers className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg">
                      Learn from mistakes
                    </span>
                  </div>
                  <span className="rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 font-mono text-[9px] text-fg-dim">
                    Full proofs
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-fg">Every answer, explained</h3>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  Every answer comes with a clear step-by-step explanation. Miss one, and the AI
                  Tutor walks through exactly where you went wrong.
                </p>
              </div>

              <div className="mt-6 rounded-lg border border-line bg-surface-1 px-4 py-3 font-mono text-[11px] text-fg">
                <code>∇L/∇W = (softmax(QKᵀ/√d) - Y) · Xᵀ</code>
              </div>
            </CardSpotlight>
          </div>
        </div>
      </section>

      {/* ── Curriculum Roadmap Matrix ─────────────────────────────────── */}
      <section id="curriculum" className="mt-28 scroll-mt-24">
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Curriculum
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-fg sm:text-4xl">
            From tensors to training clusters
          </h2>
          <p className="mt-2 max-w-xl text-xs text-fg-muted sm:text-sm">
            Four tracks that build on each other — from attention math to multi-GPU training.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CURRICULUM.map((item) => {
            const Icon = item.icon;
            return (
              <CardSpotlight key={item.tier} className="flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-fg-dim">{item.tier}</span>
                    <Icon className="h-4 w-4 text-fg" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-fg">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">{item.description}</p>
                </div>

                <div className="mt-6 border-t border-line pt-4">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-fg-dim">
                    Core Modules
                  </span>
                  <div className="mt-2 flex flex-col gap-1">
                    {item.modules.map((m) => (
                      <div
                        key={m}
                        className="flex items-center gap-1.5 font-mono text-[10px] text-fg-muted"
                      >
                        <ChevronRight className="h-2.5 w-2.5 text-fg-dim" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardSpotlight>
            );
          })}
        </div>
      </section>

      {/* ── Pricing Tiers & Final CTA ─────────────────────────────────── */}
      <PricingTiers />
    </main>
  );
}
