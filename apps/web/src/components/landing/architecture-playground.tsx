"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Cpu, Network, Layers, Binary, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

interface PlaygroundTrack {
  id: string;
  name: string;
  badge: string;
  icon: typeof Cpu;
  metric: string;
  metricLabel: string;
  description: string;
  equations: string[];
  nodes: { id: string; label: string; type: "tensor" | "op" | "kernel" }[];
  codeSnippet: string;
}

const TRACKS: PlaygroundTrack[] = [
  {
    id: "transformers",
    name: "Attention & KV-Cache",
    badge: "O(N²) -> O(N)",
    icon: Layers,
    metric: "2.4× Speedup",
    metricLabel: "FlashAttention-3 TFLOPs",
    description:
      "How attention math is tiled to fit fast on-chip memory — the same derivations you'll practice.",
    equations: [
      "Attention(Q, K, V) = softmax(Q·Kᵀ / √dₖ)·V",
      "KV Cache Size = 2 × b × s × l × h × d",
    ],
    nodes: [
      { id: "q", label: "Query [B, H, S, D]", type: "tensor" },
      { id: "k", label: "Key Cache [B, H, S, D]", type: "tensor" },
      { id: "gemm1", label: "SRAM Tiled MatMul", type: "kernel" },
      { id: "soft", label: "Online Softmax", type: "op" },
      { id: "out", label: "Context Out [B, S, H×D]", type: "tensor" },
    ],
    codeSnippet: `def forward_flash_attention(q, k, v, sm_scale):
    # Kernel fusion in GPU shared memory (SRAM)
    block_size = 128
    acc = tl.zeros([BLOCK_M, BLOCK_D], dtype=tl.float32)
    for start_n in range(0, seq_len, block_size):
        # Online softmax normalizer
        qk = tl.dot(q, k_block) * sm_scale
        acc = acc * alpha + tl.dot(p, v_block)
    return acc`,
  },
  {
    id: "distributed",
    name: "Distributed Parallelism",
    badge: "ZeRO-3 / FSDP",
    icon: Network,
    metric: "8× Scaling",
    metricLabel: "NCCL Ring All-Reduce",
    description:
      "How model weights are split across GPUs — and the messaging math that keeps them in sync.",
    equations: [
      "Ring Comm Volume = 2 × (p - 1) / p × Size",
      "ZeRO-3 Memory = (16 / p) × Parameters",
    ],
    nodes: [
      { id: "shard0", label: "GPU 0: Layer[0:8]", type: "kernel" },
      { id: "shard1", label: "GPU 1: Layer[8:16]", type: "kernel" },
      { id: "allreduce", label: "NCCL All-Gather", type: "op" },
      { id: "pipeline", label: "P2P Forward Pass", type: "tensor" },
      { id: "loss", label: "Global Reducer", type: "op" },
    ],
    codeSnippet: `class FSDPModule(torch.nn.Module):
    def forward(self, x):
        # 1. Non-blocking all-gather parameters
        dist.all_gather(self.sharded_weights, async_op=True)
        # 2. Compute local forward projection
        out = torch.matmul(x, self.sharded_weights)
        # 3. Immediately discard unsharded parameters
        self.drop_params()
        return out`,
  },
  {
    id: "cuda",
    name: "CUDA & Kernel Fusion",
    badge: "Hardware Level",
    icon: Cpu,
    metric: "91% HBM Bandwidth",
    metricLabel: "Tensor Core Occupancy",
    description:
      "How several operations get fused into a single GPU pass to skip slow memory trips.",
    equations: [
      "Arithmetic Intensity = FLOPs / Memory Access (Bytes)",
      "Warp Efficiency = Active Threads / 32",
    ],
    nodes: [
      { id: "global", label: "HBM Global Memory", type: "tensor" },
      { id: "shared", label: "Shared Memory (SRAM)", type: "kernel" },
      { id: "warp", label: "Warp Matrix Multiply (WGMMA)", type: "kernel" },
      { id: "epilogue", label: "Fused Bias + SwiGLU", type: "op" },
      { id: "out_tensor", label: "FP8 Quantized Out", type: "tensor" },
    ],
    codeSnippet: `__global__ void fused_norm_swiglu(
    const half* __restrict__ input,
    half* __restrict__ output,
    const float eps, int N
) {
    // 32 threads per warp cooperative load
    __shared__ float s_mean, s_var;
    cg::thread_block block = cg::this_thread_block();
    // In-register RMS normalization + silu(x) * y
    output[idx] = __hmul(silu(val1), val2);
}`,
  },
  {
    id: "loss",
    name: "Loss Surfaces & AdamW",
    badge: "Optimization",
    icon: Zap,
    metric: "1e-4 LR",
    metricLabel: "Cosine Annealing",
    description:
      "How the AdamW optimizer updates weights step by step — the equations behind the questions.",
    equations: [
      "mₜ = β₁·mₜ₋₁ + (1 - β₁)·gₜ",
      "θₜ = θₜ₋₁ - η·(m̂ₜ / (√v̂ₜ + ε) + λ·θₜ₋₁)",
    ],
    nodes: [
      { id: "grad", label: "Stochastic Gradients ∇L", type: "tensor" },
      { id: "mom1", label: "1st Moment Vector mₜ", type: "op" },
      { id: "mom2", label: "2nd Moment Variance vₜ", type: "op" },
      { id: "clip", label: "Global Norm Clip (1.0)", type: "kernel" },
      { id: "weight", label: "Decoupled Weight Update", type: "tensor" },
    ],
    codeSnippet: `def adamw_step(params, grads, exp_avg, exp_avg_sq, lr, wd):
    # Decoupled weight decay: independent of gradients
    p.mul_(1 - lr * wd)
    # Update biased 1st and 2nd moment estimates
    exp_avg.lerp_(g, 1 - beta1)
    exp_avg_sq.lerp_(g * g, 1 - beta2)
    step_size = lr / bias_correction1
    p.addcdiv_(exp_avg, exp_avg_sq.sqrt().add_(eps), value=-step_size)`,
  },
];

export function ArchitecturePlayground() {
  const [activeTab, setActiveTab] = useState<string>("transformers");
  const reduced = useReducedMotion();
  const track = TRACKS.find((t) => t.id === activeTab) ?? TRACKS[0];

  return (
    <section className="mt-24 scroll-mt-24">
      {/* Section Header */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <Binary className="h-3 w-3 text-fg" />
          Under the hood
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-4xl">
          See how the grading engine works
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-fg-muted sm:text-sm">
          A peek behind the curtain for the curious: the real questions, code, and math behind
          each track. Optional depth — you can start practicing without any of it.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {TRACKS.map((t) => {
          const active = t.id === activeTab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-btn border px-4 py-2 text-xs font-medium transition-colors",
                active
                  ? "border-line-strong bg-surface-3 text-fg shadow-glow"
                  : "border-line bg-surface-1 text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId="arch-tab-pill"
                  transition={reduced ? { duration: 0 } : SPRING.snappy}
                  className="absolute inset-0 rounded-btn border border-line-strong bg-surface-3 shadow-glow"
                  aria-hidden="true"
                />
              )}
              <Icon className={cn("relative z-10 h-3.5 w-3.5", active ? "text-fg" : "text-fg-dim")} />
              <span className="relative z-10">{t.name}</span>
              <span className="relative z-10 rounded-full border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-fg-dim">
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Workbench Visualizer Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={track.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={SPRING.snappy}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          {/* Left Column: Dataflow & Equations (7 cols) */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            {/* Architecture Node Dataflow */}
            <CardSpotlight className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                    Data flow
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-fg">{track.name}</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-fg">{track.metric}</div>
                  <div className="font-mono text-[10px] text-fg-dim">{track.metricLabel}</div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-fg-muted">{track.description}</p>

              {/* Dataflow Nodes */}
              <div className="mt-6 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  Tensor Pipeline
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {track.nodes.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all",
                          node.type === "kernel"
                            ? "border-brand/40 bg-brand-soft font-semibold text-fg shadow-glow"
                            : node.type === "op"
                              ? "border-line-strong bg-surface-3 text-fg-muted"
                              : "border-line bg-surface-2 text-fg-dim",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        <span>{node.label}</span>
                      </div>
                      {i < track.nodes.length - 1 && (
                        <span className="font-mono text-xs text-fg-dim">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Key equations */}
              <div className="mt-6 border-t border-line pt-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  Key equations
                </span>
                <div className="mt-2 flex flex-col gap-1.5">
                  {track.equations.map((eq) => (
                    <div
                      key={eq}
                      className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs font-medium text-fg"
                    >
                      {eq}
                    </div>
                  ))}
                </div>
              </div>
            </CardSpotlight>
          </div>

          {/* Right Column: Code Implementation Viewport (5 cols) */}
          <div className="flex flex-col lg:col-span-5">
            <div className="flex h-full flex-col overflow-hidden rounded-card border border-line-strong bg-surface-1">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <span className="ml-2 font-mono text-[11px] text-fg-muted">
                    {track.id}_kernel.py
                  </span>
                </div>
                <span className="font-mono text-[10px] text-fg-dim">PyTorch / Triton</span>
              </div>

              {/* Code Pre */}
              <div className="flex-1 overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-fg">
                <pre className="text-fg-muted">
                  <code>{track.codeSnippet}</code>
                </pre>
              </div>

              {/* Footer Indicator */}
              <div className="flex items-center justify-between border-t border-line bg-surface-2/80 px-4 py-2 text-[10px]">
                <span className="flex items-center gap-1.5 font-mono text-fg-dim">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Kernel compiled &amp; benchmarked
                </span>
                <span className="font-mono text-fg-dim">CUDA 12.4</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
