"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Code2,
  Film,
  History,
  MessageSquare,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import {
  ApiError,
  apiFetch,
  type AskHistoryItem,
  type AskResult,
  type QuotaState,
  type VideoRequestResult,
  type YoutubeRec,
} from "@/lib/api";
import { RichAnswer } from "@/components/tutor/rich-answer";
import { prefetchKatex } from "@/components/tutor/tex";
import { TypingDots } from "@/components/tutor/typing-dots";
import { StreamingAnswer } from "@/components/tutor/streaming-answer";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  Skeleton,
  SkeletonRow,
  buttonStyles,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** One exchange in the console. `answer === null` means still thinking. */
interface Turn {
  key: string;
  queryId?: string;
  question: string;
  answer: string | null;
  cached?: boolean;
  youtube?: YoutubeRec[];
  video?: VideoRequestResult | null;
  videoBusy?: boolean;
  failed?: string;
}

const MIN_QUESTION = 10;
const MAX_QUESTION = 2000;

const PROMPT_STARTERS = [
  {
    title: "Softmax Cross-Entropy",
    prompt: "Derive the gradient of softmax cross-entropy loss with respect to logits z_i.",
  },
  {
    title: "FlashAttention IO Complexity",
    prompt: "Prove the SRAM vs HBM memory access complexity reduction in FlashAttention-2.",
  },
  {
    title: "LoRA Intrinsic Rank",
    prompt: "Explain how low-rank matrix decomposition W + BA preserves model expressivity.",
  },
  {
    title: "AdamW vs Adam Decoupled",
    prompt: "Why does L2 weight decay fail in standard Adam compared to decoupled AdamW?",
  },
];

export default function AskPage() {
  const { getToken, isLoaded } = useAuth();
  const reduced = useReducedMotion();

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<AskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, AskResult>>({});
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const conversationRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    prefetchKatex();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const [h, q] = await Promise.all([
        apiFetch<{ items: AskHistoryItem[] }>("/ai/history?limit=10", { token }),
        apiFetch<QuotaState>("/quota/check?feature=ai_text", { token }),
      ]);
      setHistory(h.items);
      setQuota(q);
    } catch {
      /* non-fatal */
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    queueMicrotask(() => {
      void refresh();
    });
  }, [isLoaded, refresh]);

  const value = draft;
  const latest = turns[turns.length - 1];
  const streaming = !reduced && Boolean(latest?.answer);

  useEffect(() => {
    if (!thinking && !latest?.answer) return;
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [thinking, latest?.answer, latest?.key, reduced]);

  const canSubmit = value.trim().length >= MIN_QUESTION && value.trim().length <= MAX_QUESTION && !thinking;

  async function ask(questionOverride?: string) {
    const question = (questionOverride ?? value).trim();
    if (question.length < MIN_QUESTION || question.length > MAX_QUESTION || thinking) return;

    const key = `turn-${Date.now()}`;
    setTurns((prev) => [...prev, { key, question, answer: null }]);
    setDraft("");
    setThinking(true);
    setError(null);

    try {
      const token = await getToken();
      const result = await apiFetch<AskResult>("/ai/ask", {
        method: "POST",
        token,
        body: { question },
      });
      setTurns((prev) =>
        prev.map((turn) =>
          turn.key === key
            ? {
                ...turn,
                queryId: result.id,
                answer: result.answer,
                cached: result.cached,
                youtube: result.youtube,
              }
            : turn,
        ),
      );
      void refresh();
    } catch (e) {
      const message =
        e instanceof ApiError && e.status === 429
          ? `Daily AI answer quota reached (${e.payload.limit}/day). It resets at 00:00 UTC.`
          : e instanceof Error
            ? e.message
            : "Inference request failed.";
      setError(message);
      setTurns((prev) =>
        prev.map((turn) => (turn.key === key ? { ...turn, answer: null, failed: message } : turn)),
      );
    } finally {
      setThinking(false);
    }
  }

  async function synthesizeVideo(turnKey: string) {
    const turn = turns.find((t) => t.key === turnKey);
    if (!turn?.queryId) return;
    setTurns((prev) => prev.map((t) => (t.key === turnKey ? { ...t, videoBusy: true } : t)));
    try {
      const token = await getToken();
      const video = await apiFetch<VideoRequestResult>("/ai/videos", {
        method: "POST",
        token,
        body: { queryId: turn.queryId },
      });
      setTurns((prev) => prev.map((t) => (t.key === turnKey ? { ...t, video, videoBusy: false } : t)));
    } catch (e) {
      const message =
        e instanceof ApiError && e.status === 429
          ? (e.payload.proRequired as boolean)
            ? "Explainer generation is a Pro feature. Free tier can watch already-cached videos."
            : `Monthly video quota reached (${e.payload.limit}/mo).`
          : e instanceof Error
            ? e.message
            : "Video request failed.";
      setError(message);
      setTurns((prev) => prev.map((t) => (t.key === turnKey ? { ...t, videoBusy: false } : t)));
    }
  }

  async function toggleExpand(item: AskHistoryItem) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (expanded[item.id]) return;
    setExpandingId(item.id);
    try {
      const token = await getToken();
      const result = await apiFetch<AskResult>(`/ai/queries/${item.id}`, { token });
      setExpanded((prev) => ({ ...prev, [item.id]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that inquiry.");
      setExpandedId(null);
    } finally {
      setExpandingId(null);
    }
  }

  async function deleteQuery(id: string) {
    try {
      const token = await getToken();
      await apiFetch(`/ai/queries/${id}`, { method: "DELETE", token });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expandedId === id) setExpandedId(null);
      setArmedDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete inquiry.");
    }
  }

  async function clearAll() {
    try {
      const token = await getToken();
      await apiFetch("/ai/history", { method: "DELETE", token });
      setHistory([]);
      setExpanded({});
      setExpandedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear history.");
    }
  }

  const characterHint =
    value.length > 0 && value.length < 20
      ? `${value.length}/${MIN_QUESTION} min`
      : value.length > MAX_QUESTION - 200
        ? `${value.length}/${MAX_QUESTION} max`
        : null;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>AI Reasoning Engine</span>
            <span className="text-fg-muted">{"//"}</span>
            <span>Mathematical Derivations</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">
            AI Technical Tutor
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            Deep ML derivations, kernel mechanics, and complexity proofs formatted with LaTeX and visual explainers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {quota ? (
            quota.remaining === -1 ? (
              <Badge variant="solid">Unlimited Inference</Badge>
            ) : (
              <Badge variant={quota.remaining <= 1 ? "solid" : "outline"}>
                {quota.remaining}/{quota.limit} queries today
              </Badge>
            )
          ) : (
            <Skeleton className="h-6 w-36 rounded-full" />
          )}
        </div>
      </div>

      {/* Main Split: Navigator Rail (4 cols) + Derivation Workbench (8 cols) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Navigator Rail (4 cols) */}
        <aside className="space-y-4 lg:col-span-4">
          {/* Prompt Accelerators Card */}
          <Card className="p-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Zap className="h-4 w-4 text-white" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                Prompt Accelerators
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {PROMPT_STARTERS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setDraft(item.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left rounded-lg border border-line bg-surface-2 p-2.5 transition-all hover:border-white/40 hover:bg-surface-3"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-fg">
                    <span>{item.title}</span>
                    <ArrowRight className="h-3 w-3 text-fg-dim" />
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[11px] text-fg-muted">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent Inquiries Card */}
          <Card>
            <CardHeader className="py-3.5">
              <CardTitle className="flex items-center gap-2 text-xs">
                <History className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
                Past Inquiries
              </CardTitle>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearAll()}
                  className="font-mono text-[10px] text-fg-dim hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
            </CardHeader>

            <CardContent className="space-y-2 pt-0">
              {historyLoading && (
                <div className="space-y-2 py-2">
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <EmptyState
                  compact
                  icon={<MessageSquare className="h-4 w-4" />}
                  title="No past threads"
                  description="Your questions and derivations are cached here."
                />
              )}

              {history.map((item) => {
                const isOpen = expandedId === item.id;
                const isArmed = armedDelete === item.id;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "overflow-hidden rounded-lg border bg-surface-3 transition-colors",
                      isOpen ? "border-white/40 shadow-glow" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-start gap-2 p-2.5">
                      <button
                        type="button"
                        onClick={() => void toggleExpand(item)}
                        aria-expanded={isOpen}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-start gap-1.5">
                          <span className="mt-0.5 font-mono text-[10px] text-fg-dim">
                            {item.cached ? "⚡" : "💬"}
                          </span>
                          <span className="line-clamp-2 text-xs text-fg">
                            {item.question}
                          </span>
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-fg-dim">
                          {isOpen ? "Collapse" : "Inspect derivation"}
                        </span>
                      </button>

                      <IconButton
                        label={isArmed ? "Confirm" : "Delete"}
                        onClick={() => {
                          if (isArmed) void deleteQuery(item.id);
                          else {
                            setArmedDelete(item.id);
                            setTimeout(() => setArmedDelete((curr) => (curr === item.id ? null : curr)), 3000);
                          }
                        }}
                        className={cn(
                          isArmed && "animate-shake-x border-white bg-white text-black font-bold shadow-glow",
                          !isArmed && "hover:text-white",
                        )}
                      >
                        {isArmed ? <Check className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                      </IconButton>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={reduced ? { duration: 0 } : SPRING.soft}
                          className="overflow-hidden border-t border-line bg-surface-2 p-3"
                        >
                          {expandingId === item.id || !expanded[item.id] ? (
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-4/5" />
                            </div>
                          ) : (
                            <RichAnswer text={expanded[item.id].answer} />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        {/* Right Derivation & Reasoning Stream (8 cols) */}
        <section className="flex flex-col gap-4 lg:col-span-8">
          <div
            ref={conversationRef}
            className="flex min-h-[30rem] max-h-[65vh] flex-col gap-4 overflow-y-auto rounded-card border border-line bg-surface-1/40 p-4 shadow-card"
          >
            {turns.length === 0 && !thinking && (
              <div className="my-auto py-12">
                <EmptyState
                  icon={<Sparkles className="h-8 w-8 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]" />}
                  title="Interactive AI Derivation Console"
                  description="Ask mathematical and algorithmic questions on backpropagation, distributed parallelism, kernel compilation, or KV-cache optimization."
                  action={
                    <div className="flex items-center gap-2 font-mono text-xs text-fg-dim">
                      <Terminal className="h-3.5 w-3.5" />
                      <span>Select a prompt starter on the left or type your formula below</span>
                    </div>
                  }
                />
              </div>
            )}

            {turns.map((turn) => {
              const isLatest = turn.key === turns[turns.length - 1]?.key;
              return (
                <div key={turn.key} className="flex flex-col gap-3">
                  {/* User query bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-line-strong bg-surface-3 px-4 py-3 shadow-card">
                      <p className="text-sm leading-relaxed text-fg">{turn.question}</p>
                    </div>
                  </div>

                  {/* AI Tutor response bubble */}
                  <div className="flex justify-start">
                    <div className="max-w-[95%] min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-line bg-surface-2 p-5 shadow-card">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-6 w-6 place-items-center rounded-md border border-white/40 bg-white/10 font-mono text-[10px] font-bold text-white shadow-glow">
                            AI
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                            {turn.answer === null
                              ? "Computing Derivation…"
                              : turn.cached
                                ? "Canonical Cache Hit (~12ms)"
                                : "Fresh Analytical Inference"}
                          </span>
                        </div>

                        {turn.queryId && (
                          <div className="flex items-center gap-2">
                            {turn.video ? (
                              <Link
                                href={`/watch/${turn.video.jobId}`}
                                className={buttonStyles("secondary", "sm", "gap-1.5")}
                              >
                                <Film className="h-3 w-3" aria-hidden="true" />
                                {turn.video.cached ? "Watch explainer" : "Render Chamber"}
                              </Link>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={turn.videoBusy}
                                onClick={() => void synthesizeVideo(turn.key)}
                                leftIcon={<Film className="h-3 w-3" />}
                              >
                                Generate Explainer
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {turn.answer === null && !turn.failed && (
                        <div className="py-2">
                          <TypingDots label="Synthesizing proofs and LaTeX notations" />
                        </div>
                      )}

                      {turn.failed && (
                        <div className="flex items-start gap-2 rounded-lg border border-line-strong bg-surface-3 p-3 text-xs text-fg">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" aria-hidden="true" />
                          <span>{turn.failed}</span>
                        </div>
                      )}

                      {turn.answer !== null && (
                        <div className="prose-invert text-sm leading-relaxed">
                          <StreamingAnswer
                            key={turn.key}
                            text={turn.answer}
                            stream={Boolean(streaming && isLatest)}
                          />
                        </div>
                      )}

                      {turn.youtube && turn.youtube.length > 0 && (
                        <div className="mt-5 border-t border-line pt-3.5">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                            Reference Video Lectures
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {turn.youtube.map((video) => (
                              <a
                                key={video.video_id}
                                href={`https://www.youtube.com/watch?v=${video.video_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex gap-2.5 overflow-hidden rounded-lg border border-line bg-surface-3 p-2 transition-colors hover:border-white/40"
                              >
                                {video.thumbnail_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={video.thumbnail_url}
                                    alt=""
                                    className="h-12 w-20 shrink-0 rounded object-cover"
                                  />
                                )}
                                <span className="min-w-0">
                                  <span className="line-clamp-2 text-[11px] leading-tight font-medium text-fg group-hover:text-white">
                                    {video.title}
                                  </span>
                                  <span className="mt-0.5 block truncate font-mono text-[10px] text-fg-dim">
                                    {video.channel}
                                  </span>
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Command Bar Composer */}
          <div className="relative rounded-2xl border border-line bg-surface-2/95 p-3.5 backdrop-blur-md shadow-card">
            {error && (
              <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-xs text-fg">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" aria-hidden="true" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="font-mono text-[10px] text-fg-muted hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            )}

            <label htmlFor="ai-query-input" className="sr-only">
              Your machine learning question
            </label>
            <textarea
              id="ai-query-input"
              ref={textareaRef}
              rows={2}
              className="max-h-48 min-h-[3.5rem] w-full resize-y rounded-xl border border-line bg-surface-3 p-3 font-mono text-xs leading-relaxed text-fg transition-colors placeholder:text-fg-dim focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white/50 outline-none"
              placeholder="e.g. Derive the attention weights gradient for dQ in multi-head self attention..."
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void ask();
                }
              }}
            />

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[10px] text-fg-dim">
                <Code2 className="h-3 w-3 text-fg-muted" />
                <span>{characterHint ?? "⌘/Ctrl + Enter to reason · LaTeX maths and tensor syntax supported"}</span>
              </div>

              <Button
                variant="primary"
                onClick={() => void ask()}
                disabled={!canSubmit}
                loading={thinking}
                rightIcon={!thinking ? <Send className="h-3.5 w-3.5" /> : undefined}
              >
                {thinking ? "Reasoning" : "Derive Proof"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
