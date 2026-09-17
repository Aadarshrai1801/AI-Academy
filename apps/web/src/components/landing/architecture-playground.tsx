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
    name: "Smart Vision & Photos",
    badge: "Picture AI",
    icon: Layers,
    metric: "Super Fast!",
    metricLabel: "Recognizes in 1ms",
    description:
      "How computers look at pixel patterns and colors to recognize cute cats, dogs, and doodles!",
    rules: [
      "Rule 1: Scan shapes (Pointy ears, whiskers, fluffy tail)",
      "Rule 2: Match against saved examples of pets",
    ],
    nodes: [
      { id: "cam", label: "Camera Photo", type: "tensor" },
      { id: "pix", label: "Colors & Pixels", type: "op" },
      { id: "shape", label: "Shape Detection", type: "kernel" },
      { id: "match", label: "Pattern Matcher", type: "op" },
      { id: "out", label: "It's a Cat! 🐱", type: "tensor" },
    ],
    codeSnippet: `# How smart computers spot a pet in a picture
def spot_pet(image):
    shapes = find_shapes(image)
    if shapes.has_whiskers and shapes.has_pointy_ears:
        return "It's a cute cat! 🐱"
    return "It's a happy dog! 🐶"`,
  },
  {
    id: "language",
    name: "Language & Chat Helpers",
    badge: "Smart Words",
    icon: Network,
    metric: "10,000+ Words",
    metricLabel: "Friendly Answers",
    description:
      "How friendly AI helpers understand your questions and answer in clear, simple words!",
    rules: [
      "Rule 1: Break sentences into helpful words",
      "Rule 2: Connect ideas together to write a helpful answer",
    ],
    nodes: [
      { id: "q", label: "Your Question", type: "tensor" },
      { id: "words", label: "Word Detective", type: "op" },
      { id: "brain", label: "Knowledge Base", type: "kernel" },
      { id: "story", label: "Sentence Builder", type: "op" },
      { id: "reply", label: "Helpful Answer! 🚀", type: "tensor" },
    ],
    codeSnippet: `# How a chat helper answers your question
def answer_kid(question):
    idea = understand_question(question)
    reply = make_friendly_explanation(idea)
    return reply + " Keep exploring! ⭐"`,
  },
  {
    id: "games",
    name: "Game Playing & Robots",
    badge: "Game AI",
    icon: Cpu,
    metric: "High Score!",
    metricLabel: "Maze Completed",
    description:
      "How computers learn to play fun games, steer robots, and make smart moves!",
    rules: [
      "Rule 1: Look at the game board or maze",
      "Rule 2: Pick the move that earns the highest score",
    ],
    nodes: [
      { id: "board", label: "Maze Screen", type: "tensor" },
      { id: "sensor", label: "Wall Sensors", type: "kernel" },
      { id: "moves", label: "Check Best Path", type: "op" },
      { id: "move", label: "Move Forward", type: "kernel" },
      { id: "win", label: "Win Level! 🏆", type: "tensor" },
    ],
    codeSnippet: `# How a game robot picks the best move
def pick_best_move(game_screen):
    possible_moves = find_paths_without_walls(game_screen)
    best_move = pick_highest_points(possible_moves)
    return best_move`,
  },
  {
    id: "learning",
    name: "Daily Practice & Memory",
    badge: "Brain Power",
    icon: Zap,
    metric: "Level Up!",
    metricLabel: "Daily Streak Bonus",
    description:
      "How your brain and AI both get smarter by practicing a little bit every single day!",
    rules: [
      "Rule 1: Try a fun challenge every day",
      "Rule 2: Learn from mistakes to make your streak grow",
    ],
    nodes: [
      { id: "day", label: "Daily Puzzle", type: "tensor" },
      { id: "try", label: "Try Your Answer", type: "op" },
      { id: "clue", label: "Instant Clue", type: "kernel" },
      { id: "points", label: "+10 Points!", type: "op" },
      { id: "streak", label: "Streak Multiplier! 🔥", type: "tensor" },
    ],
    codeSnippet: `# How daily practice builds unstoppable memory
def practice_daily(streak_days):
    brain_power = streak_days * 10
    print(f"Awesome job! Streak: {streak_days} days! ⭐")
    return brain_power`,
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
          Discover How Smart Computers Think
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-fg-muted sm:text-sm">
          A fun peek behind the scenes: explore how computers see pictures, understand words, and solve mazes!
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
                    {track.id}_helper.py
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
                  Ready to run and explore
                </span>
                <span className="font-mono text-fg-dim">Friendly AI</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
