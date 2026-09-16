"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { HeroMesh } from "@/components/landing/hero-mesh";
import { LiveDemo } from "@/components/landing/live-demo";
import { Magnetic } from "@/components/landing/magnetic";
import { Reveal, StaggeredHeadline } from "@/components/landing/reveal";
import { Badge, Card, buttonStyles } from "@/components/ui";
import { cn } from "@/lib/cn";

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
    description:
      "QKV tensor projections, Scaled Dot-Product complexity, causal masking, FlashAttention, and Rotary Embeddings.",
    badge: "Core Architecture",
    modules: ["Self-Attention Complexity", "KV Cache Sizing", "Multi-Query Attention"],
  },
  {
    title: "Distributed Training & Scaling",
    description:
      "Data parallelism, FSDP, 3D tensor parallelism, Pipeline stages, and NCCL Ring All-Reduce communication volume.",
    badge: "Production Systems",
    modules: ["Ring All-Reduce", "ZeRO Memory Stages", "Gradient Synchronization"],
  },
  {
    title: "GPU Systems & CUDA Kernels",
    description:
      "Shared memory banking, warp divergence, tensor cores, memory coalescence, and Triton kernel optimizations.",
    badge: "Hardware & Compute",
    modules: ["Warp Execution", "SRAM vs HBM Bandwidth", "Kernel Fusion"],
  },
  {
    title: "Loss Surfaces & Optimization",
    description:
      "AdamW update equations, second-moment bias correction, gradient clipping, RMSNorm, and learning rate schedules.",
    badge: "Optimization Theory",
    modules: ["Adam Optimizer Math", "RMSNorm Derivations", "Loss Landscape Saddles"],
  },
  {
    title: "Mathematical Foundations & Stats",
    description:
      "Gaussian normal distributions, confidence intervals, Bayes theorem, hypothesis testing, and matrix calculus.",
    badge: "Analytical Depth",
    modules: ["Bayes Posterior Updates", "Heteroscedasticity", "P-Value Interpretations"],
  },
  {
    title: "Inference & Quantization",
    description:
      "FP8, INT4 weight-only quantization, speculative decoding, continuous batching, and vLLM PagedAttention.",
    badge: "Deployment & Serving",
    modules: ["PagedAttention Mechanics", "Quantization Noise", "Speculative Drafting"],
  },
];

const TELEMETRY = [
  "100% free daily tier",
  "PyTorch 2.5 & CUDA 12.4",
  "Zero prompt-engineering fluff",
];

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Signed-in visitors land straight in the workbench. Note the gate is
  // `isLoaded && isSignedIn`, not `!isLoaded` — gating on "not loaded yet"
  // would make this page ship a spinner as its server-rendered HTML, leaving
  // crawlers and first paint with nothing to read. Logged-out visitors get the
  // full marketing page immediately; only a signed-in session sees the
  // interstitial while the redirect happens.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/practice");
  }, [isLoaded, isSignedIn, router]);

  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-20 sm:px-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-14 sm:pt-24">
        <HeroMesh />

        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/70 px-3.5 py-1 font-mono text-[11px] text-fg-muted backdrop-blur">
            <span className="relative grid h-1.5 w-1.5 place-items-center">
              <span className="absolute h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="absolute h-1.5 w-1.5 animate-pulse-ring rounded-full bg-brand" />
            </span>
            Production-grade machine learning practice
          </div>
        </Reveal>

        <StaggeredHeadline
          className="mt-6 max-w-4xl text-3xl font-bold tracking-tight text-fg sm:text-5xl sm:leading-[1.1]"
          lines={[
            { text: "The practice ground for engineers" },
            { text: "who build models", accent: true },
            { text: "— not just prompt them." },
          ]}
        />

        <Reveal delay={0.18}>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">
            Daily deliberate practice across backpropagation, transformer attention mechanics, GPU
            kernels, and distributed training. Compete on the daily epoch leaderboard and accelerate
            intuition with on-demand AI reasoning.
          </p>
        </Reveal>

        <Reveal delay={0.26}>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Magnetic>
              <Link
                href="/sign-up"
                className={buttonStyles("primary", "lg", "group gap-2 shadow-[0_0_28px_rgba(249,115,22,0.28)]")}
              >
                Start practising free
                <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/sign-in" className={buttonStyles("secondary", "lg")}>
                Sign in
              </Link>
            </Magnetic>
          </div>
        </Reveal>

        <Reveal delay={0.34}>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-fg-muted">
            {TELEMETRY.map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <section className="mt-6">
        <Reveal>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                Live preview
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">
                This is the actual workbench
              </h2>
            </div>
            <p className="max-w-md text-xs text-fg-muted">
              Real questions, real grading component. Watch a question select, submit, and converge —
              then go do it for points.
            </p>
          </div>
          <LiveDemo />
        </Reveal>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────────── */}
      <section id="features" className="mt-20 scroll-mt-24">
        <Reveal>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Platform capabilities
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Engineered for deep mathematical &amp; systems retention
          </h2>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pillars.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 0.07}>
              <Card interactive className="group h-full p-6">
                <div className="flex items-center gap-2">
                  <span className="text-lg transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-125">
                    {pillar.icon}
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand">
                    {pillar.tag}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-fg">{pillar.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">{pillar.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Curriculum ───────────────────────────────────────────────────── */}
      <section id="curriculum" className="mt-20 scroll-mt-24">
        <Reveal>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Core curriculum
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            From attention tensors to CUDA kernels
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-fg-muted">
            Progressive problem sets spanning modern foundation model architecture, low-level GPU
            memory mechanics, and distributed scaling.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curriculumTracks.map((track, index) => (
            <Reveal key={track.title} delay={index * 0.06}>
              <Card interactive accent="iris" className="flex h-full flex-col justify-between p-5">
                <div>
                  <Badge variant="neutral" size="sm" square>
                    {track.badge}
                  </Badge>
                  <h3 className="mt-3 text-sm font-semibold text-fg">{track.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{track.description}</p>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    Sample modules
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {track.modules.map((module) => (
                      <span
                        key={module}
                        className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                      >
                        {module}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <section className="relative mt-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-modal border border-brand/30 bg-surface-2 px-6 py-14 text-center sm:px-12">
            {/* Radial glow behind the headline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(249,115,22,0.16), transparent 70%)",
              }}
            />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-3 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-brand">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Free forever tier
              </span>

              <h2 className="mx-auto mt-5 max-w-2xl text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                Ready to test your machine learning depth?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-fg-muted sm:text-sm">
                The free tier includes 10 questions daily, full streak continuity, and public ranking.
                No credit card required.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Magnetic>
                  <Link href="/sign-up" className={buttonStyles("primary", "lg", "group gap-2")}>
                    Create your account
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1" />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/pricing" className={buttonStyles("secondary", "lg")}>
                    Compare plans
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
