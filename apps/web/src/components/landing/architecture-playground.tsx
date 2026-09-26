"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Cpu, Network, Layers, Zap } from "lucide-react";
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
  rules: string[];
  nodes: { id: string; label: string; type: "tensor" | "op" | "kernel" }[];
  codeSnippet: string;
}

const TRACKS: PlaygroundTrack[] = [
  {
    id: "vision",
    name: "Computer Vision",
    badge: "Vision",
    icon: Layers,
    metric: "1 ms",
    metricLabel: "Inference latency",
    description:
      "How learned convolutional features turn raw pixel tensors into calibrated class predictions.",
    rules: [
      "Rule 1: Project pixels through learned feature filters",
      "Rule 2: Score logits against the label distribution",
    ],
    nodes: [
      { id: "cam", label: "Image Tensor", type: "tensor" },
      { id: "pix", label: "Pixel Encoding", type: "op" },
      { id: "shape", label: "Feature Maps", type: "kernel" },
      { id: "match", label: "Classifier Head", type: "op" },
      { id: "out", label: "Class + Confidence", type: "tensor" },
    ],
    codeSnippet: `# How a classifier scores an image
def classify(image):
    features = conv_stack(image)
    logits = classifier_head(features)
    return softmax(logits).argmax()`,
  },
  {
    id: "language",
    name: "Language & Transformers",
    badge: "NLP",
    icon: Network,
    metric: "200K",
    metricLabel: "Token context",
    description:
      "How attention layers turn token sequences into contextual representations for downstream tasks.",
    rules: [
      "Rule 1: Project tokens into query, key, and value vectors",
      "Rule 2: Weight every position by attention similarity",
    ],
    nodes: [
      { id: "q", label: "Token Sequence", type: "tensor" },
      { id: "words", label: "Token Embeddings", type: "op" },
      { id: "brain", label: "Attention Stack", type: "kernel" },
      { id: "story", label: "Feed-Forward Block", type: "op" },
      { id: "reply", label: "Contextual Output", type: "tensor" },
    ],
    codeSnippet: `# How a decoder layer produces contextual states
def attend(tokens):
    q, k, v = project_qkv(tokens)
    weights = softmax(q @ k.transpose(-2, -1) / sqrt(d))
    return weights @ v`,
  },
  {
    id: "rl",
    name: "Reinforcement Learning",
    badge: "RL",
    icon: Cpu,
    metric: "Policy π",
    metricLabel: "After update",
    description:
      "How agents improve a policy from reward signals, and how exploration avoids local optima.",
    rules: [
      "Rule 1: Sample trajectories from the current policy",
      "Rule 2: Update parameters toward expected return",
    ],
    nodes: [
      { id: "board", label: "State s", type: "tensor" },
      { id: "sensor", label: "Policy π(a|s)", type: "kernel" },
      { id: "moves", label: "Action Logprob", type: "op" },
      { id: "move", label: "Gradient Step", type: "kernel" },
      { id: "win", label: "Updated π′", type: "tensor" },
    ],
    codeSnippet: `# How a policy improves from sampled experience
def improve(trajectories):
    returns = compute_discounted_returns(trajectories.rewards)
    loss = -surrogate_objective(trajectories.actions, returns)
    return gradient_step(loss)`,
  },
  {
    id: "mastery",
    name: "Deliberate Practice",
    badge: "Mastery",
    icon: Zap,
    metric: "+2.4x",
    metricLabel: "Retention gain",
    description:
      "How spaced repetition and error analysis convert weak topics into durable, measurable mastery.",
    rules: [
      "Rule 1: Re-surface a topic near its forgetting curve",
      "Rule 2: Log the miss and re-queue it sooner",
    ],
    nodes: [
      { id: "day", label: "Topic Queue", type: "tensor" },
      { id: "try", label: "Graded Attempt", type: "op" },
      { id: "clue", label: "Mastery Model", type: "kernel" },
      { id: "points", label: "Score Delta", type: "op" },
      { id: "streak", label: "Next Interval", type: "tensor" },
    ],
    codeSnippet: `# How the scheduler picks the next topic
def schedule(topics, now):
    for topic in topics:
        topic.retention *= exp(-elapsed(topic) / topic.half_life)
    return min(topics, key=lambda t: t.retention)`,
  },
];

export function ArchitecturePlayground() {
  const [activeTab, setActiveTab] = useState<string>("vision");
  const reduced = useReducedMotion();
  const track = TRACKS.find((t) => t.id === activeTab) ?? TRACKS[0];

  return (
    <section className="mt-24 scroll-mt-24">
      {/* Section Header */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span>Interactive Playground</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-4xl">
          Inside the Model Stack
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-fg-muted sm:text-sm">
          Trace the dataflow: how raw inputs become predictions, and where the compute actually goes.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {TRACKS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-btn border px-4 py-2 text-xs font-semibold transition-colors",
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
              <span className="relative z-10">{t.name}</span>
              <span className="relative z-10 rounded-full border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-fg-dim">
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Symmetrical Visualizer Grid (Equal 50/50 Columns) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={track.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={SPRING.snappy}
          className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Left Column: Dataflow & Rules (50%) */}
          <div className="flex flex-col">
            <CardSpotlight className="flex h-full flex-col justify-between p-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                      How It Works
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-fg">{track.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base font-bold text-fg">{track.metric}</div>
                    <div className="font-mono text-[10px] text-fg-dim">{track.metricLabel}</div>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-fg-muted">{track.description}</p>

                {/* Flow Steps */}
                <div className="mt-6 flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    Step-by-Step Flow
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

                {/* Key Rules */}
                <div className="mt-6 border-t border-line pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    Key Rules
                  </span>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {track.rules.map((rule) => (
                      <div
                        key={rule}
                        className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs font-medium text-fg"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardSpotlight>
          </div>

          {/* Right Column: Code Logic Viewport (50%) */}
          <div className="flex flex-col">
            <div className="flex h-full flex-col overflow-hidden rounded-card border border-line-strong bg-surface-1">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong bg-surface-4" />
                  <span className="ml-2 font-mono text-[11px] text-fg-muted">
                    {track.id}_forward.py
                  </span>
                </div>
                <span className="font-mono text-[10px] text-fg-dim">Python Code</span>
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
                  Ready to run
                </span>
                <span className="font-mono text-fg-dim">Reference impl</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
