"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, RotateCcw, TriangleAlert } from "lucide-react";
import {
  ApiError,
  TOPICS,
  apiFetch,
  type AttemptResultDTO,
  type QuestionDTO,
} from "@/lib/api";
import { QuestionVisual } from "@/components/question-visual";
import { OptionCard, type OptionVerdict } from "@/components/practice/option-card";
import { QuestionSkeleton } from "@/components/practice/question-skeleton";
import { SpeedTimer, SPEED_BONUS_SECONDS } from "@/components/practice/speed-timer";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DifficultyBadge,
  EmptyState,
  ProgressBar,
  Skeleton,
  AnimatedNumber,
  buttonStyles,
  useToast,
} from "@/components/ui";
import { EASE, SPRING } from "@/lib/motion";
import { requestTelemetryRefresh, useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/cn";

type Difficulty = "easy" | "medium" | "hard";
type DifficultyFilter = "" | Difficulty;

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyFilter; label: string }> = [
  { value: "", label: "Any" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/** Question swap: out left, in from the right with a little overshoot (§2.2). */
const QUESTION_SWAP = {
  enter: { opacity: 0, x: 28 },
  center: { opacity: 1, x: 0, transition: SPRING.snappy },
  exit: { opacity: 0, x: -28, transition: { duration: 0.2, ease: EASE.outExpo } },
} as const;

/** Same normalisation the grader uses, so verdict highlights cannot disagree. */
const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

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
        try {
          const challenge = await apiFetch<QuestionDTO>(`/questions/${challengeId}`, {
            token: await getToken(),
          });
          setQuestion(challenge);
          startedAt.current = Date.now();
        } catch (e) {
          setError(e instanceof Error ? `Challenge unavailable: ${e.message}` : "Challenge unavailable.");
        } finally {
          setLoading(false);
        }
      })();
    } else {
      // Initial question load. `loadNext` sets `loading` synchronously so the
      // skeleton paints in the same frame as the navigation — the lint rule
      // prefers deferred state updates, but a delayed skeleton is worse UX.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadNext(difficulty, topic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Live clock. Ticks while a question is unanswered.
  useEffect(() => {
    if (!question || result) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [question, result]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectOption = useCallback((option: string, index: number) => {
    setAnswer(option);
    // Mirror the click ripple for keyboard users (§2.2).
    setRipples((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
  }, []);

  const submit = useCallback(async () => {
    if (!question || !answer.trim() || submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTakenMs = Math.max(1000, Date.now() - startedAt.current);
      const graded = await apiFetch<AttemptResultDTO>("/attempts", {
        method: "POST",
        token: await token(),
        body: { questionId: question.id, answer: answer.trim(), timeTakenMs },
      });
      setResult(graded);
      // Shell telemetry (streak badge, quota ring) reacts to the graded attempt.
      requestTelemetryRefresh();

      if (graded.isCorrect) {
        const earnedBonus = timeTakenMs <= SPEED_BONUS_SECONDS * 1000;
        toast({
          title: `+${graded.pointsAwarded} pts`,
          description: earnedBonus
            ? `1.5× speed bonus · ${graded.streak.current}d streak`
            : `${graded.streak.current}d streak`,
          variant: "success",
          duration: 1800,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed — try again.");
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

      if (result) {
        if (event.key === "Enter") {
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

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, result, difficulty, topic, submit, loadNext, selectOption]);

  // ── Derived verdicts ──────────────────────────────────────────────────────

  const correctOptionIndex =
    result && question?.options
      ? question.options.findIndex((option) => norm(option) === norm(result.correctAnswer))
      : -1;

  function verdictFor(index: number): OptionVerdict {
    if (!result) return "idle";
    if (index === correctOptionIndex) return answer === question?.options?.[index] ? "correct" : "revealed";
    if (question?.options?.[index] === answer) return "incorrect";
    return "idle";
  }

  const attemptNumber = result ? todayAttempts : todayAttempts + 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Practice
          </span>

          <label className="sr-only" htmlFor="topic-filter">
            Topic
          </label>
          <select
            id="topic-filter"
            className="rounded-btn border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-fg transition-colors hover:border-line-strong focus-visible:border-brand"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              void loadNext(difficulty, event.target.value);
            }}
          >
            <option value="">All topics</option>
            {TOPICS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {/* Difficulty segmented control — current state is always visible. */}
          <div
            role="radiogroup"
            aria-label="Difficulty"
            className="flex items-center gap-0.5 rounded-btn border border-line bg-surface-3 p-0.5"
          >
            {DIFFICULTY_OPTIONS.map((option) => {
              const active = difficulty === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDifficulty(option.value);
                    void loadNext(option.value, topic);
                  }}
                  className={cn(
                    "relative rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors",
                    active ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="difficulty-active"
                      transition={reduced ? { duration: 0 } : SPRING.snappy}
                      className="absolute inset-0 rounded-[6px] bg-surface-4 shadow-card"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
                </button>
              );
            })}
          </div>

          {question && <DifficultyBadge difficulty={question.difficulty} />}
          {question?.repeated && (
            <Badge variant="warning" size="sm">
              Revisit
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {question && !loading && (
            <SpeedTimer
              elapsedSeconds={elapsedSeconds}
              clockVisible={clockVisible}
              onToggleClock={() => setClockVisible((v) => !v)}
              frozen={Boolean(result)}
            />
          )}
        </div>
      </div>

      {/* Session progress */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-fg-muted">
          {telemetry.loading ? (
            <Skeleton className="inline-block h-3 w-36 align-middle" />
          ) : unlimited ? (
            <>
              Question <span className="font-semibold text-fg">{attemptNumber}</span> today
            </>
          ) : (
            <>
              Question <span className="font-semibold text-fg">{attemptNumber}</span>
              <span className="text-fg-dim"> of {dailyLimit}</span> today
            </>
          )}
        </span>

        {!unlimited && !telemetry.loading && (
          <div className="min-w-[8rem] max-w-xs flex-1">
            <ProgressBar
              value={Math.min(todayAttempts, Math.max(dailyLimit, 1))}
              max={Math.max(dailyLimit, 1)}
              tone="brand"
              label={`${todayAttempts} of ${dailyLimit} questions answered today`}
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <QuestionSkeleton />}

      {/* Error */}
      {error && !loading && (
        <Card className="mt-6">
          <EmptyState
            icon={<TriangleAlert className="h-6 w-6 text-error" />}
            title="Could not load a question"
            description={error}
            action={
              <>
                <Button
                  variant="secondary"
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => void loadNext(difficulty, topic)}
                >
                  Try again
                </Button>
                <Button variant="ghost" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </>
            }
          />
        </Card>
      )}

      {/* Quota exhausted */}
      {paywall && !loading && (
        <Card className="mt-6">
          <EmptyState
            icon={<CalendarClock className="h-6 w-6 text-brand" />}
            title={`Today's practice is complete (${paywall.limit} questions)`}
            description={
              <>
                Your free allowance refills at 00:00 UTC
                {paywall.resetAt
                  ? ` — that's ${new Date(paywall.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} your time`
                  : ""}
                . Pro raises the daily cap to 500 questions and unlocks hard-mode sets.
              </>
            }
            action={
              <>
                <Link href="/pricing" className={buttonStyles("primary")}>
                  Compare plans
                </Link>
                <Link href="/dashboard" className={buttonStyles("secondary")}>
                  Review your analytics
                </Link>
              </>
            }
          />
        </Card>
      )}

      {/* Question + options */}
      {question && !loading && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={question.id}
            variants={QUESTION_SWAP}
            initial="enter"
            animate="center"
            exit="exit"
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12"
          >
            {/* Problem specification */}
            <section className="flex flex-col rounded-card border border-line bg-surface-2 p-6 shadow-card lg:col-span-7">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h1 className="text-sm font-semibold text-fg">Problem specification</h1>
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  {question.topic}
                  {question.subtopic ? ` · ${question.subtopic}` : ""}
                </span>
              </div>

              <p className="mt-4 text-base leading-relaxed font-medium text-fg">{question.prompt}</p>

              <QuestionVisual question={question} />
            </section>

            {/* Answer pane */}
            <section className="flex flex-col rounded-card border border-line bg-surface-2 p-6 shadow-card lg:col-span-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="text-sm font-semibold text-fg">
                  {question.type === "mcq" ? "Options" : "Your answer"}
                </h2>
                {question.type === "mcq" && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    Keys 1–{question.options?.length ?? 4} · ⌘/Ctrl + Enter
                  </span>
                )}
              </div>

              {question.type === "mcq" && question.options ? (
                <div className="mt-4 flex flex-col gap-2.5" role="radiogroup" aria-label="Answer options">
                  {question.options.map((option, index) => (
                    <OptionCard
                      key={option}
                      index={index}
                      text={option}
                      selected={answer === option}
                      verdict={verdictFor(index)}
                      disabled={Boolean(result) || submitting}
                      rippleKey={ripples[index] ?? 0}
                      onSelect={() => selectOption(option, index)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <label className="sr-only" htmlFor="freeform-answer">
                    Your answer
                  </label>
                  <textarea
                    id="freeform-answer"
                    className="min-h-40 w-full rounded-card border border-line bg-surface-3 p-3.5 font-mono text-xs leading-5 text-fg placeholder-fg-dim transition-colors focus-visible:border-brand disabled:opacity-60"
                    placeholder="Provide the mathematical expression or computational argument…"
                    value={answer}
                    disabled={Boolean(result) || submitting}
                    onChange={(event) => setAnswer(event.target.value)}
                  />
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                <Button
                  variant="ghost"
                  onClick={() => void loadNext(difficulty, topic)}
                  disabled={loading}
                >
                  Skip
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={!answer.trim() || Boolean(result)}
                  loading={submitting}
                >
                  {result ? "Graded" : submitting ? "Grading" : "Submit answer"}
                </Button>
              </div>
            </section>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Verdict + explanation */}
      <AnimatePresence>
        {result && question && (
          <motion.div
            key={result.attemptId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            className="mt-6"
          >
            <Card
              className={cn(
                "border",
                result.isCorrect ? "border-success/40" : "border-error/40",
              )}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={result.isCorrect ? "success" : "error"}
                    size="md"
                    dot={result.isCorrect}
                  >
                    {result.isCorrect ? "Converged — accurate" : "Diverged — incorrect"}
                  </Badge>
                  <span className="font-mono text-xs text-fg-muted">
                    <AnimatedNumber value={result.pointsAwarded} prefix="+" suffix=" pts" duration={0.45} />
                  </span>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                  Daily score <AnimatedNumber value={result.dailyScore} className="text-fg" duration={0.45} />
                </span>
              </CardHeader>

              <CardContent>
                {!result.isCorrect && (
                  <div className="rounded-card border border-error/30 bg-error-soft p-3 text-xs text-fg">
                    <span className="font-mono font-semibold text-error">Correct answer: </span>
                    {result.correctAnswer}
                  </div>
                )}

                <div className="mt-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                    Proof &amp; explanation
                  </p>
                  <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-fg">
                    {result.explanation}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="font-mono text-[11px] text-fg-muted">
                    Streak{" "}
                    <span className="font-semibold text-brand tabular-nums">
                      {result.streak.current}d
                    </span>{" "}
                    <span className="text-fg-dim">· best {result.streak.longest}d</span>
                  </span>
                  <Button onClick={() => void loadNext(difficulty, topic)}>
                    Next question
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nothing loaded yet and nothing to show: invite a first attempt. */}
      {!question && !loading && !error && !paywall && (
        <Card className="mt-6">
          <EmptyState
            icon={<CalendarClock className="h-6 w-6 text-brand" />}
            title="Ready when you are"
            description="Pick a topic and difficulty above, or start with everything mixed."
            action={<Button onClick={() => void loadNext("", "")}>Start practising</Button>}
          />
        </Card>
      )}
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
