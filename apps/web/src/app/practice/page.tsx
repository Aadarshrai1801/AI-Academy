"use client";

/**
 * /practice — one question, minimal chrome (design plan §4.1).
 *
 * Why this looks this way:
 * - The question is the only thing on the page at Title weight; the HUD is a
 *   single 48px row because this screen is used 10-50x a day.
 * - Feedback replaces the answer slot in place: the question never moves, and
 *   a wrong answer reads as "help arrived" (review amber, LifeBuoy icon,
 *   "Not quite yet — here's the idea") rather than a red alert or a popup.
 * - Correct answers get exactly one motion moment: a growth left-edge on the
 *   verdict plus a count-up of the points. No confetti, no shake.
 * - Mono is reserved for code answers; prose questions and explanations are
 *   sans because they are language, not data.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Flame,
  LifeBuoy,
  TriangleAlert,
} from "lucide-react";
import {
  ApiError,
  TOPICS,
  apiFetch,
  type AttemptResultDTO,
  type QuestionDTO,
} from "@/lib/api";
import { QuestionVisual } from "@/components/question-visual";
import { OptionCard } from "@/components/practice/option-card";
import { QuestionSkeleton } from "@/components/practice/question-skeleton";
import { SpeedTimer } from "@/components/practice/speed-timer";
import {
  AnimatedNumber,
  Button,
  Card,
  DifficultyBadge,
  EmptyState,
  ProgressBar,
  buttonStyles,
  useToast,
} from "@/components/ui";
import { EASE, SPRING } from "@/lib/motion";
import { requestTelemetryRefresh, useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/cn";

type Difficulty = "easy" | "medium" | "hard";
type DifficultyFilter = "" | Difficulty;

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyFilter; label: string }> = [
  { value: "", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/** Question swap: out left, in from the right with spring overshoot. */
const QUESTION_SWAP = {
  enter: { opacity: 0, x: 28 },
  center: { opacity: 1, x: 0, transition: SPRING.snappy },
  exit: { opacity: 0, x: -28, transition: { duration: 0.2, ease: EASE.outExpo } },
} as const;

function PracticeInner() {
  const { getToken, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("q");
  const toast = useToast();
  const reduced = useReducedMotion();
  const telemetry = useTelemetry();

  const [difficulty, setDifficulty] = useState<DifficultyFilter>("");
  const [topic, setTopic] = useState<string>("");
  const [question, setQuestion] = useState<QuestionDTO | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AttemptResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ limit: number; resetAt?: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockVisible, setClockVisible] = useState(true);
  const [ripples, setRipples] = useState<Record<number, number>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);

  const startedAt = useRef(0);
  const token = useCallback(async () => getToken(), [getToken]);

  const todayAttempts = telemetry.summary?.today.attempts ?? 0;
  const dailyLimit = telemetry.quota?.limit ?? -1;
  const unlimited = dailyLimit === -1;

  // ── Data ──────────────────────────────────────────────────────────────────

  const loadNext = useCallback(
    async (diff: string, nextTopic: string) => {
      setLoading(true);
      setError(null);
      setPaywall(null);
      setResult(null);
      setAnswer("");
      setElapsedSeconds(0);
      setRipples({});

      try {
        const params = new URLSearchParams();
        if (diff) params.set("difficulty", diff);
        if (nextTopic) params.set("topic", nextTopic);
        const next = await apiFetch<QuestionDTO>(`/questions/next?${params.toString()}`, {
          token: await token(),
        });
        setQuestion(next);
        startedAt.current = Date.now();
        requestTelemetryRefresh();
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          setPaywall({
            limit: (e.payload.limit as number) ?? 10,
            resetAt: e.payload.resetAt as string | undefined,
          });
          setQuestion(null);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("ai-academy:quota-expired"));
          }
        } else if (e instanceof ApiError && e.status === 404) {
          setQuestion(null);
          setError("No questions match this topic and difficulty. Try widening the filters.");
        } else {
          setQuestion(null);
          setError(
            e instanceof Error
              ? `Could not load a question: ${e.message}`
              : "Could not load a question.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (challengeId) {
      void (async () => {
        setLoading(true);
        setError(null);
        setPaywall(null);
        setResult(null);
        setAnswer("");
        setElapsedSeconds(0);
        try {
          const loaded = await apiFetch<QuestionDTO>(`/questions/${challengeId}`, {
            token: await token(),
          });
          setQuestion(loaded);
          startedAt.current = Date.now();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load the challenge question.");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    const timer = setTimeout(() => {
      void loadNext(difficulty, topic);
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoaded, challengeId, loadNext, difficulty, topic, token]);

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!question || loading || Boolean(result)) return;
    const interval = setInterval(() => {
      if (startedAt.current > 0) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)));
      }
    }, 250);
    return () => clearInterval(interval);
  }, [question, loading, result]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectOption = useCallback(
    (option: string, index: number) => {
      if (result || submitting) return;
      setAnswer(option);
      setRipples((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
    },
    [result, submitting],
  );

  const submit = useCallback(async () => {
    if (!question || !answer.trim() || submitting || result) return;
    setSubmitting(true);
    setError(null);

    // Anti-cheat floor matches the API (`MIN_TIME_MS`) and the Gauntlet modal:
    // a sub-second answer would otherwise be rejected with a 400.
    const timeTakenMs =
      startedAt.current > 0 ? Math.max(1000, Date.now() - startedAt.current) : 1000;

    try {
      const graded = await apiFetch<AttemptResultDTO>("/attempts", {
        method: "POST",
        token: await token(),
        body: {
          questionId: question.id,
          answer: answer.trim(),
          timeTakenMs,
        },
      });
      setResult(graded);
      requestTelemetryRefresh();

      if (graded.streak.freezeApplied) {
        toast({
          title: "Streak freeze used",
          description: `A freeze covered your missed day — ${graded.streak.current}d streak protected.`,
          variant: "brand",
          duration: 2600,
        });
      }
    } catch (e) {
      // Attempt-side exhaustion: the question stays on screen (a retry of an
      // already-attempted question is still free) and the paywall explains
      // that only NEW questions are blocked until the reset.
      if (
        e instanceof ApiError &&
        e.status === 429 &&
        (e.payload.feature as string | undefined) === "practice_questions"
      ) {
        setPaywall({
          limit: (e.payload.limit as number) ?? 10,
          resetAt: e.payload.resetAt as string | undefined,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ai-academy:quota-expired"));
        }
      } else {
        setError(e instanceof Error ? e.message : "Submission failed — try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [question, answer, submitting, result, token, toast]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      if (typing) {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          void submit();
        }
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if (event.key === "Escape") {
        setShowShortcuts(false);
        return;
      }

      if (result) {
        // Feedback is in place now: Enter/Space moves to the next question.
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void loadNext(difficulty, topic);
        }
        return;
      }

      const numeric = Number.parseInt(event.key, 10);
      if (question?.type === "mcq" && question.options && numeric >= 1 && numeric <= question.options.length) {
        event.preventDefault();
        selectOption(question.options[numeric - 1], numeric - 1);
      }

      if (
        ((event.metaKey || event.ctrlKey) && event.key === "Enter") ||
        (Boolean(answer) && (event.key === "Enter" || event.key === " "))
      ) {
        event.preventDefault();
        void submit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, answer, result, difficulty, topic, submit, loadNext, selectOption]);

  const attemptNumber = result ? todayAttempts : todayAttempts + 1;
  const currentStreak = telemetry.summary?.streak.current ?? 0;

  // Pre-built tutor question: the missed question plus both answers, so the
  // tutor has full context the moment the user lands on /ask.
  const tutorPrompt =
    result && question
      ? [
          "I got this practice question wrong. Walk me through it step by step.",
          "",
          `Topic: ${question.topic} (${question.difficulty})`,
          `Question: ${question.prompt}`,
          `My answer: ${answer.trim() || "—"}`,
          `Correct answer: ${result.correctAnswer}`,
          "",
          "Explain the key concept, why my answer is wrong, and how to approach similar questions.",
        ]
          .join("\n")
          .slice(0, 2000)
      : "";

  // Structured deep-link: /ask keys its mistake-explanation cache on
  // (question, wrong answer), so pass the fields instead of a composed blob.
  const tutorHref =
    result && question
      ? `/ask?prompt=${encodeURIComponent(tutorPrompt)}` +
        `&questionId=${encodeURIComponent(question.id)}` +
        `&userAnswer=${encodeURIComponent(answer.trim() || "—")}` +
        `&correctAnswer=${encodeURIComponent(result.correctAnswer)}`
      : "/ask";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Top Floating Session HUD ────────────────────────────────────────── */}
      <header className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-btn border border-line bg-surface-1/90 px-4 py-2.5 backdrop-blur-xl">
        {/* Left: Filters & Topic */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Topic Selector */}
          <div className="relative">
            <label className="sr-only" htmlFor="topic-filter">
              Topic
            </label>
            <select
              id="topic-filter"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                void loadNext(difficulty, e.target.value);
              }}
              className="rounded-btn border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-line-strong focus-visible:outline-none"
            >
              <option value="">All Topics</option>
              {TOPICS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty sliding pills */}
          <div className="flex items-center rounded-btn border border-line bg-surface-2 p-0.5" role="group">
            {DIFFICULTY_OPTIONS.map((opt) => {
              const active = difficulty === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setDifficulty(opt.value);
                    void loadNext(opt.value, topic);
                  }}
                  className={cn(
                    "relative rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors",
                    active ? "text-brand-ink" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="difficulty-active-pill"
                      transition={reduced ? { duration: 0 } : SPRING.snappy}
                      className="absolute inset-0 rounded-[6px] bg-brand-soft"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {question && (
            <span className="flex items-center gap-2">
              <DifficultyBadge difficulty={question.difficulty} />
              {question.adaptive && (
                <span
                  title="Difficulty picked from your mastery band for this topic"
                  className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[11px] text-fg-dim"
                >
                  picked for your level
                </span>
              )}
            </span>
          )}
        </div>

        {/* Center: Session Tracker */}
        <div className="hidden items-center gap-3 sm:flex">
          <span className="font-mono text-xs text-fg-muted">
            {unlimited ? (
              <>Question <span className="font-semibold text-fg">{attemptNumber}</span></>
            ) : (
              <>
                Question <span className="font-semibold text-fg">{attemptNumber}</span>
                <span className="text-fg-dim">/{dailyLimit}</span>
              </>
            )}
          </span>
          {!unlimited && (
            <div className="w-20">
              <ProgressBar
                value={Math.min(todayAttempts, Math.max(dailyLimit, 1))}
                max={Math.max(dailyLimit, 1)}
                tone="brand"
                label="Daily progress"
              />
            </div>
          )}
        </div>

        {/* Right: Timer, Streak, Shortcuts */}
        <div className="flex items-center gap-3">
          {question && !loading && (
            <SpeedTimer
              elapsedSeconds={elapsedSeconds}
              clockVisible={clockVisible}
              onToggleClock={() => setClockVisible((v) => !v)}
              frozen={Boolean(result)}
            />
          )}

          {/* Streak pill — growth hue: a streak is progress, not a warning. */}
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs text-fg">
            <Flame className="h-3.5 w-3.5 text-growth fill-growth/20" />
            <span className="font-bold">{currentStreak}d</span>
          </div>

          {/* Keyboard shortcut trigger */}
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="flex items-center rounded-btn border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-3"
          >
            Help &amp; Tips
          </button>
        </div>
      </header>

      {/* ── Loading Skeleton ────────────────────────────────────────────────── */}
      {loading && <QuestionSkeleton />}

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && !loading && (
        <Card className="mt-6">
          <EmptyState
            icon={<TriangleAlert className="h-6 w-6 text-warning" />}
            title="Could not load a question"
            description={error}
            action={
              <>
                <Button
                  variant="secondary"
                  onClick={() => void loadNext(difficulty, topic)}
                >
                  Try Again
                </Button>
                <Button variant="ghost" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </>
            }
          />
        </Card>
      )}

      {/* ── Quota Complete ─────────────────────────────────────────────────── */}
      {paywall && !loading && (
        <Card className="mt-6">
          <EmptyState
            icon={<CalendarClock className="h-6 w-6 text-fg" />}
            title={`Today's practice goal complete (${paywall.limit} questions)!`}
            description="Awesome job today! Your daily practice resets at 00:00 UTC. You can still retry questions you solved today, or unlock unlimited questions with Pro!"
            action={
              <>
                <Link href="/pricing" className={buttonStyles("primary")}>
                  Compare Plans
                </Link>
                <Link href="/dashboard" className={buttonStyles("secondary")}>
                  View Progress
                </Link>
              </>
            }
          />
        </Card>
      )}

      {/* ── Symmetrical Practice Area (Equal 50/50 Split) ─────────────────── */}
      {question && !loading && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={question.id}
            variants={QUESTION_SWAP}
            initial="enter"
            animate="center"
            exit="exit"
            className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-2"
          >
            {/* Left: the question itself — the only thing at Title weight. */}
            <div className="surface-work p-5 sm:p-6">
              <h1 className="text-lg font-semibold leading-7 tracking-tight text-fg sm:text-xl sm:leading-8">
                {question.prompt}
              </h1>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs text-fg-muted">Concept reminder</p>
                <div className="mt-2">
                  <QuestionVisual question={question} />
                </div>
              </div>
            </div>

            {/* Right: answers, replaced in place by the verdict when graded —
                the question never moves, and help arrives where you answered. */}
            <div className="surface-work p-5 sm:p-6">
              {result ? (
                <motion.div
                  key={result.attemptId}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE.outExpo }}
                  className={cn(
                    "flex h-full flex-col justify-between border-l-2 pl-4",
                    result.isCorrect ? "border-growth" : "border-review",
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {result.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-growth" aria-hidden="true" />
                      ) : (
                        <LifeBuoy className="h-5 w-5 shrink-0 text-review" aria-hidden="true" />
                      )}
                      <h2 className="text-base font-semibold text-fg">
                        {result.isCorrect ? "Correct" : "Not quite yet — here's the idea"}
                      </h2>
                      {result.isCorrect && !result.isRetry && (
                        <span className="ml-auto font-mono text-sm font-semibold tabular-nums text-growth-ink">
                          +<AnimatedNumber value={result.pointsAwarded} duration={0.3} /> pts
                        </span>
                      )}
                      {result.isRetry && (
                        <span className="ml-auto text-xs text-fg-dim">Retry — no points</span>
                      )}
                    </div>

                    {result.isCorrect && !result.isRetry && result.streak.current > 0 && (
                      <p className="mt-1 text-xs text-fg-muted">
                        {result.streak.current}-day streak
                      </p>
                    )}

                    {!result.isCorrect && (
                      <div className="mt-4 grid gap-1.5 text-sm">
                        <p className="text-fg-muted">
                          Your answer: <span className="text-fg">{answer.trim() || "—"}</span>
                        </p>
                        <p className="text-fg-muted">
                          Expected:{" "}
                          <span className="font-medium text-fg">{result.correctAnswer}</span>
                        </p>
                      </div>
                    )}

                    <p className="mt-4 text-sm leading-6 text-fg-muted">{result.explanation}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <Button onClick={() => void loadNext(difficulty, topic)}>Next question</Button>
                    {!result.isCorrect && (
                      <Button variant="secondary" onClick={() => setResult(null)}>
                        Try again
                      </Button>
                    )}
                    <Link href={tutorHref} className={buttonStyles("secondary")}>
                      {result.isCorrect ? "Ask a follow-up" : "Walk me through it"}
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                      <h2 className="text-sm font-semibold text-fg">
                        {question.type === "mcq" ? "Choose your answer" : "Type your answer"}
                      </h2>
                      {question.type === "mcq" && question.options ? (
                        <span className="text-[11px] text-fg-dim">
                          Keys 1–{question.options.length}
                        </span>
                      ) : null}
                    </div>

                    {question.type === "mcq" && question.options ? (
                      <div
                        className="mt-4 flex flex-col gap-2.5"
                        role="radiogroup"
                        aria-label="Answer choices"
                      >
                        {question.options.map((option, index) => (
                          <OptionCard
                            key={option}
                            index={index}
                            text={option}
                            selected={answer === option}
                            verdict="idle"
                            disabled={submitting}
                            rippleKey={ripples[index] ?? 0}
                            onSelect={() => selectOption(option, index)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <textarea
                          id="freeform-answer"
                          className={cn(
                            "min-h-40 w-full rounded-work border border-line bg-surface-3 p-3.5 text-fg placeholder-fg-dim transition-colors focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30",
                            question.type === "code"
                              ? "font-mono text-xs leading-5"
                              : "text-sm leading-6",
                          )}
                          placeholder="Type your answer…"
                          value={answer}
                          disabled={submitting}
                          onChange={(e) => setAnswer(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadNext(difficulty, topic)}
                      disabled={loading}
                    >
                      Skip question
                    </Button>
                    <Button
                      onClick={() => void submit()}
                      disabled={!answer.trim() || submitting}
                      loading={submitting}
                    >
                      {submitting ? "Checking…" : "Submit answer"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}


      {/* ── Shortcuts Cheat Sheet Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-modal border border-line-strong bg-surface-1 p-6 shadow-glow"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-fg">Helpful Keyboard Shortcuts</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(false)}
                  className="rounded-btn border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-fg-muted hover:border-line-strong hover:text-fg"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2.5 font-mono text-xs">
                {[
                  { key: "1 – 4", desc: "Select answer choice 1 through 4" },
                  { key: "Enter / Space", desc: "Submit choice or advance to next question" },
                  { key: "⌘ / Ctrl + Enter", desc: "Submit from text box" },
                  { key: "?", desc: "Open this helper guide" },
                  { key: "Esc", desc: "Close popup windows" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="rounded border border-line bg-surface-3 px-2 py-0.5 text-fg">
                      {item.key}
                    </span>
                    <span className="text-fg-muted">{item.desc}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <Button size="sm" onClick={() => setShowShortcuts(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <QuestionSkeleton />
        </main>
      }
    >
      <PracticeInner />
    </Suspense>
  );
}
