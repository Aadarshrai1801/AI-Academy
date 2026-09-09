"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ApiError,
  TOPICS,
  apiFetch,
  type AttemptResultDTO,
  type QuestionDTO,
  type QuotaState,
} from "@/lib/api";
import { QuestionVisual } from "@/components/question-visual";

type Difficulty = "easy" | "medium" | "hard";

function PracticeInner() {
  const { getToken, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("q");

  const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
  const [topic, setTopic] = useState<string>("");
  const [question, setQuestion] = useState<QuestionDTO | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AttemptResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ limit: number; resetAt?: string } | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);

  // Timer & Session Telemetry
  const startedAt = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerVisible, setTimerVisible] = useState(true);
  const [showConvergeAnim, setShowConvergeAnim] = useState(false);

  const token = useCallback(async () => getToken(), [getToken]);

  const refreshQuota = useCallback(async () => {
    try {
      const q = await apiFetch<QuotaState>(
        "/quota/check?feature=practice_questions",
        { token: await token() },
      );
      setQuota(q);
    } catch {
      /* non-fatal */
    }
  }, [token]);

  // Clock ticker for current question
  useEffect(() => {
    if (!question || result) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [question, result]);

  const loadNext = useCallback(
    async (diff: string, top: string) => {
      setLoading(true);
      setError(null);
      setPaywall(null);
      setResult(null);
      setAnswer("");
      setElapsedSeconds(0);
      setShowConvergeAnim(false);

      try {
        const params = new URLSearchParams();
        if (diff) params.set("difficulty", diff);
        if (top) params.set("topic", top);
        const q = await apiFetch<QuestionDTO>(
          `/questions/next?${params.toString()}`,
          { token: await token() },
        );
        setQuestion(q);
        startedAt.current = Date.now();
        void refreshQuota();
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          setPaywall({
            limit: (e.payload.limit as number) ?? 10,
            resetAt: e.payload.resetAt as string | undefined,
          });
          setQuestion(null);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("hoopr:quota-expired"));
          }
        } else if (e instanceof ApiError && e.status === 404) {
          setError("No questions found for this topic and difficulty. Change filters to continue.");
        } else {
          setError(
            e instanceof Error
              ? `Could not load question: ${e.message}. Check that the API server is online.`
              : "Could not load question.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [token, refreshQuota],
  );

  // Initial load
  useEffect(() => {
    if (!isLoaded) return;
    if (challengeId) {
      void (async () => {
        setLoading(true);
        try {
          const q = await apiFetch<QuestionDTO>(`/questions/${challengeId}`, {
            token: await getToken(),
          });
          setQuestion(q);
          startedAt.current = Date.now();
        } catch (e) {
          setError(e instanceof Error ? `Challenge unavailable: ${e.message}` : "Challenge unavailable.");
        } finally {
          setLoading(false);
        }
      })();
    } else {
      void loadNext(difficulty, topic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const submit = useCallback(async () => {
    if (!question || !answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTakenMs = Math.max(1000, Date.now() - startedAt.current);
      const r = await apiFetch<AttemptResultDTO>("/attempts", {
        method: "POST",
        token: await token(),
        body: { questionId: question.id, answer: answer.trim(), timeTakenMs },
      });
      setResult(r);
      if (r.isCorrect) {
        setShowConvergeAnim(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission evaluation failed.");
    } finally {
      setSubmitting(false);
    }
  }, [question, answer, submitting, token]);

  // Keyboard navigation shortcuts: 1-4 to select option, Cmd+Enter to submit, Enter to continue
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in a textarea or input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
        return;
      }

      if (result) {
        if (e.key === "Enter") {
          e.preventDefault();
          void loadNext(difficulty, topic);
        }
        return;
      }

      if (question?.type === "mcq" && question.options) {
        const keyIndex = parseInt(e.key, 10);
        if (keyIndex >= 1 && keyIndex <= question.options.length) {
          e.preventDefault();
          setAnswer(question.options[keyIndex - 1]);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, result, difficulty, topic, submit, loadNext]);

  // Format timer into MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const difficultyColors = {
    easy: "text-[var(--converged)] border-[var(--converged)]/30 bg-[var(--converged)]/10",
    medium: "text-[var(--tungsten)] border-[var(--tungsten)]/30 bg-[var(--tungsten)]/10",
    hard: "text-[var(--diverged)] border-[var(--diverged)]/30 bg-[var(--diverged)]/10",
  };

  const difficultyDots = {
    easy: "bg-[var(--converged)]",
    medium: "bg-[var(--tungsten)]",
    hard: "bg-[var(--diverged)]",
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Workbench Crown / Telemetry Rail */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--seam)] pb-4">
        {/* Left: Topic & Breadcrumb */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--ink-lead)]">PRACTICE //</span>
          <span className="text-xs font-medium text-[var(--ink-chalk)]">
            {topic || "All Domains"}
          </span>
          {question && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                difficultyColors[question.difficulty as Difficulty] || "border-[var(--seam)] text-[var(--ink-lead)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  difficultyDots[question.difficulty as Difficulty] || "bg-[var(--ink-lead)]"
                }`}
              />
              {question.difficulty}
            </span>
          )}
        </div>

        {/* Right: Telemetry & Discrete Filters */}
        <div className="flex items-center gap-3">
          {/* Active Question Timer */}
          {question && !result && (
            <button
              onClick={() => setTimerVisible(!timerVisible)}
              className="flex items-center gap-1.5 rounded border border-[var(--seam)] bg-[var(--chassis)] px-2 py-1 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
              title="Click to toggle timer visibility"
            >
              <span className="text-[10px]">⏱</span>
              <span className="tabular-nums">
                {timerVisible ? formatTime(elapsedSeconds) : "••:••"}
              </span>
            </button>
          )}

          {/* Daily Quota Counter */}
          <div className="hidden font-mono text-xs text-[var(--ink-lead)] sm:block">
            {quota ? (
              <span>
                {quota.remaining === -1 ? "Quota: ∞" : `${quota.remaining}/${quota.limit} today`}
              </span>
            ) : null}
          </div>

          {/* Discrete Filters */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Difficulty"
              className="rounded border border-[var(--seam)] bg-[var(--chassis)] px-2.5 py-1 text-xs text-[var(--ink-chalk)] focus-visible:border-[var(--tungsten)]"
              value={difficulty}
              onChange={(e) => {
                const d = e.target.value as "" | Difficulty;
                setDifficulty(d);
                void loadNext(d, topic);
              }}
            >
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <select
              aria-label="Topic"
              className="rounded border border-[var(--seam)] bg-[var(--chassis)] px-2.5 py-1 text-xs text-[var(--ink-chalk)] focus-visible:border-[var(--tungsten)]"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                void loadNext(difficulty, e.target.value);
              }}
            >
              <option value="">All topics</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mt-20 flex flex-col items-center justify-center text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--seam)] border-t-[var(--tungsten)]" />
          <p className="mt-4 font-mono text-xs text-[var(--ink-lead)]">
            Synthesizing problem candidate from parameter bank…
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mt-8 rounded-lg border border-[var(--diverged)]/30 bg-[var(--diverged)]/5 p-6 text-sm text-[var(--ink-chalk)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[var(--diverged)]">Could not load question</h2>
              <p className="mt-1 text-xs text-[var(--ink-lead)] leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => loadNext(difficulty, topic)}
              className="rounded border border-[var(--seam)] bg-[var(--chassis)] px-3 py-1 text-xs font-medium text-[var(--ink-chalk)] hover:border-[var(--tungsten)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Daily Quota Complete Notice */}
      {paywall && !loading && (
        <div className="mt-8 rounded-lg border border-[var(--seam-highlight)] bg-[var(--chassis)] p-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 rounded bg-[var(--tungsten)]/10 px-2 py-0.5 font-mono text-xs text-[var(--tungsten)] w-fit">
              <span>EPOCH QUOTA COMPLETE</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ink-chalk)]">
              Daily practice limit reached ({paywall.limit}/day)
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-lead)]">
              Practice attempts replenish daily at 00:00 UTC{" "}
              {paywall.resetAt ? `(resets at ${new Date(paywall.resetAt).toLocaleTimeString()})` : ""}.
              Review your performance statistics on the dashboard or explore study groups.
            </p>
          </div>
        </div>
      )}

      {/* Main Dual-Pane Question Canvas */}
      {question && !result && !loading && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Pane: Problem Specification (58%) */}
          <section className="flex flex-col rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6 lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3 text-xs text-[var(--ink-lead)]">
              <span className="font-mono text-xs text-[var(--ink-chalk)] font-medium">Problem Specification</span>
              {question.repeated && (
                <span className="rounded bg-[var(--tungsten)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--tungsten)]">
                  REVISIT
                </span>
              )}
            </div>

            {/* Prompt Text */}
            <div className="mt-4 text-base font-medium leading-relaxed text-[var(--ink-chalk)]">
              {question.prompt}
            </div>

            {/* Dynamic Topic-Specific Architecture / Visual Schema */}
            <QuestionVisual question={question} />
          </section>

          {/* Right Pane: Decision Matrix & Action Controls (42%) */}
          <section className="flex flex-col justify-between rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3 text-xs text-[var(--ink-lead)]">
                <span className="font-mono text-xs text-[var(--ink-chalk)] font-medium">Options</span>
                <span className="font-mono text-[10px] text-[var(--ink-lead)]">KEYBOARD [1-4]</span>
              </div>

              {/* Options List */}
              {question.type === "mcq" && question.options ? (
                <div className="mt-4 flex flex-col gap-2.5">
                  {question.options.map((opt, idx) => {
                    const isSelected = answer === opt;
                    const keyNumber = idx + 1;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(opt)}
                        className={`group flex w-full items-start gap-3 rounded-md border p-3.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-[var(--tungsten)] bg-[var(--tungsten)]/10 text-[var(--ink-chalk)] shadow-[0_0_12px_rgba(229,133,55,0.15)]"
                            : "border-[var(--seam)] bg-[var(--panel)] text-[var(--ink-lead)] hover:border-[var(--seam-highlight)] hover:text-[var(--ink-chalk)]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border font-mono text-[11px] font-semibold transition-colors ${
                            isSelected
                              ? "border-[var(--tungsten)] bg-[var(--tungsten)] text-black"
                              : "border-[var(--seam-highlight)] bg-[var(--chassis)] text-[var(--ink-lead)] group-hover:text-[var(--ink-chalk)]"
                          }`}
                        >
                          {keyNumber}
                        </span>
                        <span className="leading-5 text-[var(--ink-chalk)]">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <textarea
                    aria-label="Your mathematical solution or code response"
                    className="min-h-40 w-full rounded-md border border-[var(--seam)] bg-[var(--panel)] p-3.5 font-mono text-xs leading-5 text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
                    placeholder="Provide mathematical expression or computational argument…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 border-t border-[var(--seam)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => loadNext(difficulty, topic)}
                  className="rounded-md border border-[var(--seam)] px-4 py-2 text-xs font-medium text-[var(--ink-lead)] transition-colors hover:border-[var(--seam-highlight)] hover:text-[var(--ink-chalk)]"
                >
                  Skip
                </button>

                <button
                  type="button"
                  onClick={submit}
                  disabled={!answer.trim() || submitting}
                  className="flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{submitting ? "Grading…" : "Submit answer"}</span>
                  <span className="rounded bg-black/20 px-1 py-0.5 font-mono text-[10px] text-black/80">
                    ⌘↵
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Post-Submission Result State */}
      {result && (
        <section
          className={`mt-6 rounded-lg border p-6 ${
            result.isCorrect
              ? "border-[var(--converged)]/40 bg-[var(--converged)]/5"
              : "border-[var(--diverged)]/40 bg-[var(--diverged)]/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--seam)] pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  result.isCorrect ? "bg-[var(--converged)]" : "bg-[var(--diverged)]"
                } ${showConvergeAnim ? "animate-epoch-converge" : ""}`}
              />
              <h2 className="font-mono text-sm font-semibold text-[var(--ink-chalk)]">
                {result.isCorrect ? "CONVERGED — ACCURATE" : "DIVERGED — FAILED CONSTRAINTS"}
              </h2>
            </div>
            <div className="font-mono text-xs font-medium text-[var(--ink-chalk)] tabular-nums">
              +{result.pointsAwarded} pts awarded
            </div>
          </div>

          {!result.isCorrect && (
            <div className="mt-4 rounded border border-[var(--diverged)]/30 bg-[var(--diverged)]/10 p-3 text-xs text-[var(--ink-chalk)]">
              <span className="font-mono font-medium text-[var(--diverged)]">Correct Solution: </span>
              <span>{result.correctAnswer}</span>
            </div>
          )}

          <div className="mt-4 text-xs leading-relaxed text-[var(--ink-chalk)]">
            <div className="font-mono text-[11px] text-[var(--ink-lead)] mb-1">PROOF & EXPLANATION //</div>
            <p className="whitespace-pre-wrap">{result.explanation}</p>
          </div>

          {/* Telemetry updates */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--seam)] pt-4 text-xs text-[var(--ink-lead)]">
            <div className="flex items-center gap-4 font-mono">
              <span>Daily Score: <strong className="text-[var(--ink-chalk)] tabular-nums">{result.dailyScore}</strong></span>
              <span>
                Streak: <strong className="text-[var(--tungsten)] tabular-nums">{result.streak.current}d</strong>{" "}
                (best {result.streak.longest}d)
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadNext(difficulty, topic)}
              className="flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
            >
              <span>Next question</span>
              <span className="rounded bg-black/20 px-1 py-0.5 font-mono text-[10px] text-black/80">
                ↵
              </span>
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 text-center font-mono text-xs text-[var(--ink-lead)]">
          Initializing practice environment…
        </main>
      }
    >
      <PracticeInner />
    </Suspense>
  );
}
