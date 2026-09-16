"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Film,
  History,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
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

  // Inline expansion for past inquiries (fetched on demand).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, AskResult>>({});
  const [expandingId, setExpandingId] = useState<string | null>(null);
  // Two-step delete: the icon arms (turns solid, shakes) before it will delete.
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const conversationRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Warm KaTeX while the user is still composing.
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
      /* non-fatal: the console still works without history */
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [isLoaded, refresh]);

  /** Composer value: a chip-driven typewriter, or whatever the user typed. */
  const value = draft;

  const latest = turns[turns.length - 1];
  const streaming = !reduced && Boolean(latest?.answer);

  // Keep the newest exchange in view while it streams.
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
      ? `${value.length}/${MIN_QUESTION} minimum`
      : value.length > MAX_QUESTION - 200
        ? `${value.length}/${MAX_QUESTION} maximum`
        : null;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>AI Tutor</span>
            <span className="text-iris">{"//"}</span>
            <span>Async reasoning engine</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">
            Ask a technical question
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            ML and systems questions only. Answers come back with derivations, typeset maths, and
            optional visual explainers.
          </p>
        </div>

        {quota ? (
          quota.remaining === -1 ? (
            <Badge variant="iris">Unlimited queries</Badge>
          ) : (
            <Badge variant={quota.remaining <= 1 ? "warning" : "neutral"}>
              {quota.remaining}/{quota.limit} fresh queries today
            </Badge>
          )
        ) : (
          <Skeleton className="h-6 w-40 rounded-full" />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Conversation column */}
        <section className="flex flex-col gap-4 lg:col-span-7">
          <div
            ref={conversationRef}
            className="flex max-h-[60vh] min-h-[22rem] flex-col gap-4 overflow-y-auto pr-1"
          >
            {turns.length === 0 && !thinking && (
              <Card>
                <EmptyState
                  icon={<Sparkles className="h-6 w-6 text-iris" />}
                  title="Ask anything about the maths behind the models"
                  description="Derivations, complexity analysis, and architecture comparisons — answered with typeset maths."
                  action={
                    <span className="font-mono text-[11px] text-fg-dim">
                      Try one of the prompts on the right
                    </span>
                  }
                />
              </Card>
            )}

            {turns.map((turn) => {
              const isLatest = turn.key === turns[turns.length - 1]?.key;
              return (
                <div key={turn.key} className="flex flex-col gap-3">
                  {/* User bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-card rounded-br-sm border border-line-strong bg-surface-3 px-4 py-3">
                      <p className="text-sm leading-relaxed text-fg">{turn.question}</p>
                    </div>
                  </div>

                  {/* Assistant bubble */}
                  <div className="flex justify-start">
                    <div className="max-w-[92%] min-w-0 flex-1 rounded-card rounded-bl-sm border border-line bg-surface-2 p-4 shadow-card">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-iris-soft font-mono text-[10px] font-bold text-iris">
                            AI
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                            {turn.answer === null
                              ? "Reasoning"
                              : turn.cached
                                ? "Canonical cache"
                                : "Fresh inference"}
                          </span>
                        </div>

                        {turn.queryId && (
                          <div className="flex items-center gap-1.5">
                            {turn.video ? (
                              <Link
                                href={`/watch/${turn.video.jobId}`}
                                className={buttonStyles("secondary", "sm", "gap-1.5")}
                              >
                                <Film className="h-3 w-3" aria-hidden="true" />
                                {turn.video.cached ? "Watch explainer" : "Open render chamber"}
                              </Link>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={turn.videoBusy}
                                onClick={() => void synthesizeVideo(turn.key)}
                                leftIcon={<Film className="h-3 w-3" />}
                              >
                                Visual explainer
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {turn.answer === null && !turn.failed && <TypingDots />}

                      {turn.failed && (
                        <div className="flex items-start gap-2 rounded-card border border-error/30 bg-error-soft p-3 text-xs text-fg">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />
                          {turn.failed}
                        </div>
                      )}

                      {turn.answer !== null && (
                        <StreamingAnswer
                          key={turn.key}
                          text={turn.answer}
                          stream={Boolean(streaming && isLatest)}
                        />
                      )}

                      {turn.youtube && turn.youtube.length > 0 && (
                        <div className="mt-4 border-t border-line pt-3">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                            Recommended lectures
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {turn.youtube.map((video) => (
                              <a
                                key={video.video_id}
                                href={`https://www.youtube.com/watch?v=${video.video_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex gap-2.5 overflow-hidden rounded-lg border border-line bg-surface-3 p-2 transition-colors hover:border-[var(--brand-ring)]"
                              >
                                {video.thumbnail_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={video.thumbnail_url}
                                    alt=""
                                    className="h-12 w-20 shrink-0 rounded object-cover"
                                  />
                                ) : null}
                                <span className="min-w-0">
                                  <span className="line-clamp-2 text-[11px] leading-tight font-medium text-fg group-hover:text-brand">
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

            {thinking && turns[turns.length - 1]?.answer === null && (
              <div className="flex justify-start">
                <div className="rounded-card rounded-bl-sm border border-line bg-surface-2 px-4 py-3">
                  <TypingDots label="Retrieving and deriving" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="glass-panel sticky bottom-0 rounded-card border border-line p-3">
            {error && (
              <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-error/30 bg-error-soft px-3 py-2 text-xs text-fg">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="font-mono text-[10px] text-fg-muted hover:text-fg"
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
              className="max-h-48 min-h-[3.5rem] w-full resize-y rounded-lg border border-line bg-surface-3 p-3 text-sm leading-relaxed text-fg transition-colors placeholder:text-fg-dim focus-visible:border-iris"
              placeholder="e.g. Derive the gradient of the softmax cross-entropy loss with respect to the logits."
              value={value}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void ask();
                }
              }}
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <span
                className={cn(
                  "font-mono text-[10px] transition-colors",
                  characterHint && value.length < MIN_QUESTION ? "text-warning" : "text-fg-dim",
                  characterHint && value.length > MAX_QUESTION - 200 && value.length <= MAX_QUESTION
                    ? "text-warning"
                    : undefined,
                  value.length > MAX_QUESTION ? "text-error" : undefined,
                )}
              >
                {characterHint ?? "⌘/Ctrl + Enter to send · maths and code supported"}
              </span>

              <Button
                onClick={() => void ask()}
                disabled={!canSubmit}
                loading={thinking}
                rightIcon={!thinking ? <Send className="h-3.5 w-3.5" /> : undefined}
              >
                {thinking ? "Reasoning" : "Ask"}
              </Button>
            </div>
          </div>
        </section>

        {/* Sidebar: recent inquiries */}
        <aside className="flex flex-col gap-4 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                Recent inquiries
              </CardTitle>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void clearAll()}>
                  Clear all
                </Button>
              )}
            </CardHeader>

            <CardContent className="flex flex-col gap-2">
              {historyLoading && (
                <div className="flex flex-col">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <EmptyState
                  compact
                  icon={<MessageSquare className="h-5 w-5" />}
                  title="No inquiries yet"
                  description="Your questions land here so you can revisit an explanation later."
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
                      isOpen ? "border-iris/40" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => void toggleExpand(item)}
                        aria-expanded={isOpen}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5 font-mono text-[10px] text-fg-dim">
                            {item.cached ? "⚡" : "💬"}
                          </span>
                          <span className="line-clamp-2 text-xs leading-relaxed text-fg">
                            {item.question}
                          </span>
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-fg-dim">
                          {isOpen ? "Hide answer" : "Inspect"}
                        </span>
                      </button>

                      <IconButton
                        label={isArmed ? "Confirm delete" : "Delete inquiry"}
                        onClick={() => {
                          if (isArmed) void deleteQuery(item.id);
                          else {
                            setArmedDelete(item.id);
                            setTimeout(() => setArmedDelete((current) => (current === item.id ? null : current)), 3000);
                          }
                        }}
                        className={cn(
                          isArmed && "animate-shake-x border-error bg-error text-on-brand hover:bg-error",
                          !isArmed && "hover:text-error",
                        )}
                      >
                        {isArmed ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </IconButton>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={reduced ? { duration: 0 } : SPRING.soft}
                          className="overflow-hidden border-t border-line bg-surface-2"
                        >
                          <div className="p-3.5">
                            {expandingId === item.id || !expanded[item.id] ? (
                              <div className="flex flex-col gap-2">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-11/12" />
                                <Skeleton className="h-3 w-9/12" />
                              </div>
                            ) : (
                              <RichAnswer text={expanded[item.id].answer} />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
