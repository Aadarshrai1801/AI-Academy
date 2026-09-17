"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Flame,
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
import { OptionCard, type OptionVerdict } from "@/components/practice/option-card";
import { QuestionSkeleton } from "@/components/practice/question-skeleton";
import { SpeedTimer, SPEED_BONUS_SECONDS } from "@/components/practice/speed-timer";
import {
  Button,
  Card,
  CardSpotlight,
  DifficultyBadge,
  EmptyState,
  ProgressBar,
  buttonStyles,
  useToast,
  MovingBorder,
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

/** Grader normalization. */
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tutorDismissedFor, setTutorDismissedFor] = useState<string | null>(null);

  const startedAt = useRef(0);
  const tutorCtaRef = useRef<HTMLAnchorElement>(null);
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
      setTutorDismissedFor(null);

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

      if (graded.isCorrect && !graded.isRetry) {
        const earnedBonus = Math.floor(timeTakenMs / 1000) <= SPEED_BONUS_SECONDS;
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
        if (result && !result.isCorrect) setTutorDismissedFor(result.attemptId);
        setShowShortcuts(false);
        return;
      }

      if (result) {
        // While the tutor popup is open, Enter/Space must not skip ahead —
        // the focused popup buttons handle activation natively.
        const popupOpen = !result.isCorrect && tutorDismissedFor !== result.attemptId;
        if (!popupOpen && (event.key === "Enter" || event.key === " ")) {
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
  }, [question, answer, result, difficulty, topic, submit, loadNext, selectOption, tutorDismissedFor]);

  // ── Derived verdicts ──────────────────────────────────────────────────────

  const correctOptionIndex =
    result && question?.options
      ? question.options.findIndex((option) => norm(option) === norm(result.correctAnswer))
      : -1;

  const chosenOptionIndex =
    result && question?.options
      ? question.options.findIndex((option) => norm(option) === norm(answer))
      : -1;

  function verdictFor(index: number): OptionVerdict {
    if (!result) return "idle";
    if (index === correctOptionIndex) return "correct";
    if (index === chosenOptionIndex && !result.isCorrect) return "incorrect";
    return "idle";
  }

  const attemptNumber = result ? todayAttempts : todayAttempts + 1;
  const currentStreak = telemetry.summary?.streak.current ?? 0;

  // Wrong answers skip the inline verdict section entirely — a popup routes
  // the user to the AI Tutor instead. Dismissing it falls back to the plain
  // question view (the header keeps its "Next question" action).
  const showTutorPopup = Boolean(
    result && !result.isCorrect && tutorDismissedFor !== result.attemptId,
  );

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

  useEffect(() => {
    if (showTutorPopup) tutorCtaRef.current?.focus();
  }, [showTutorPopup]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Top Floating Session HUD ────────────────────────────────────────── */}
      <header className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface-1/90 px-4 py-2.5 backdrop-blur-xl shadow-card">
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
              className="rounded-btn border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs font-medium text-fg transition-colors hover:border-line-strong focus-visible:outline-none"
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
                      className="absolute inset-0 rounded-[6px] bg-brand-soft shadow-card"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {question && <DifficultyBadge difficulty={question.difficulty} />}
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

          {/* Streak pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs text-fg">
            <Flame className="h-3.5 w-3.5 text-warning fill-warning/20" />
            <span className="font-bold">{currentStreak}d</span>
          </div>

          {/* Keyboard shortcut trigger */}
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="flex items-center rounded-btn border border-line bg-surface-2 px-3 py-1 font-mono text-xs font-semibold text-fg transition-colors hover:border-line-strong hover:bg-surface-3 shadow-xs"
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
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* Left Pane: Question & Helpful Diagram (50% width) */}
            <div className="flex flex-col gap-4">
              <CardSpotlight className="flex h-full flex-col justify-between p-6 shadow-card">
                <div>
                  {/* Header Meta */}
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-fg-dim">
                        Question #{question.id.slice(-6)}
                      </span>
                      <span className="text-fg-dim">·</span>
                      <span className="font-mono text-[11px] font-medium text-fg">
                        {question.topic}
                      </span>
                    </div>
                    {question.subtopic && (
                      <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 font-mono text-[9px] text-fg-dim">
                        {question.subtopic}
                      </span>
                    )}
                  </div>

                  {/* Question Prompt Text */}
                  <div className="mt-4 rounded-xl border border-line bg-surface-1 p-4 font-mono text-sm leading-relaxed text-fg">
                    {question.prompt}
                  </div>

                  {/* Helpful Visual Diagram */}
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                      <span>Visual Diagram</span>
                      <span>Concept Clue</span>
                    </div>
                    <QuestionVisual question={question} />
                  </div>
                </div>
              </CardSpotlight>
            </div>

            {/* Right Pane: Answer Choices & Actions (50% width) */}
            <div className="flex flex-col gap-4">
              <CardSpotlight className="flex h-full flex-col justify-between p-6 shadow-card">
                <div>
                  {/* Board Header */}
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <h2 className="text-sm font-semibold text-fg">
                      {question.type === "mcq" ? "Choose Your Answer" : "Type Your Answer"}
                    </h2>
                    <div className="font-mono text-[10px] text-fg-dim">
                      <span>Keys 1–{question.options?.length ?? 4}</span>
                    </div>
                  </div>

                  {/* Options List */}
                  {question.type === "mcq" && question.options ? (
                    <div className="mt-4 flex flex-col gap-2.5" role="radiogroup" aria-label="Answer choices">
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
                      <textarea
                        id="freeform-answer"
                        className="min-h-48 w-full rounded-card border border-line bg-surface-3 p-3.5 font-mono text-xs leading-5 text-fg placeholder-fg-dim transition-colors focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30"
                        placeholder="Type your explanation or answer here…"
                        value={answer}
                        disabled={Boolean(result) || submitting}
                        onChange={(e) => setAnswer(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void loadNext(difficulty, topic)}
                    disabled={loading}
                  >
                    Skip Question
                  </Button>

                  <div className="flex items-center gap-2">
                    {result ? (
                      <Button onClick={() => void loadNext(difficulty, topic)}>
                        Next Question
                      </Button>
                    ) : (
                      <MovingBorder duration={3000} className="p-[1px]">
                        <button
                          type="button"
                          onClick={() => void submit()}
                          disabled={!answer.trim() || submitting}
                          className="flex h-9 items-center gap-2 rounded-btn bg-brand px-5 font-mono text-xs font-bold text-on-brand shadow-sm transition-all hover:bg-brand-strong disabled:opacity-50"
                        >
                          {submitting ? "Checking…" : "Submit Answer"}
                        </button>
                      </MovingBorder>
                    )}
                  </div>
                </div>
              </CardSpotlight>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Solution Drawer (correct answers) ─────────────────────────────────── */}
      <AnimatePresence>
        {result && question && result.isCorrect && (
          <motion.div
            key={result.attemptId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={SPRING.pop}
            className="mt-6"
          >
            <div className="rounded-card border border-brand/40 bg-surface-2 p-6 shadow-card transition-all">
              {/* Verdict Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-fg">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-mono text-sm font-bold uppercase tracking-wider">
                      Correct! Great Job!
                    </span>
                  </div>

                  <span className="rounded-full border border-line-strong bg-surface-3 px-2.5 py-0.5 font-mono text-xs font-semibold text-fg">
                    +{result.pointsAwarded} pts
                  </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs text-fg-dim">
                  <span>
                    Streak: <span className="font-bold text-fg">{result.streak.current}d</span>
                  </span>
                  <span>
                    Today: <span className="font-bold text-fg">{result.dailyScore} pts</span>
                  </span>
                </div>
              </div>

              {/* Body: Explanation */}
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    Explanation &amp; Solution
                  </span>
                  <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-fg">
                    {result.explanation}
                  </p>
                </div>

                {/* AI Helper Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link
                    href={`/ask?prompt=${encodeURIComponent(tutorPrompt)}`}
                    className="inline-flex items-center rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs font-semibold text-fg transition-colors hover:border-line-strong hover:bg-surface-4"
                  >
                    Ask AI Helper
                  </Link>

                  <Button onClick={() => void loadNext(difficulty, topic)}>
                    Next Question
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Wrong-Answer Tutor Popup ────────────────────────────────────────── */}
      <AnimatePresence>
        {showTutorPopup && result && question && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTutorDismissedFor(result.attemptId)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tutor-popup-title"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
              transition={SPRING.pop}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-modal border border-line-strong bg-surface-1 p-6 shadow-glow"
            >
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-state-negative-soft font-mono text-sm font-bold text-state-negative">
                    !
                  </span>
                  <div>
                    <h3 id="tutor-popup-title" className="text-sm font-bold text-fg">
                      Not quite right — let&apos;s learn together!
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-fg-dim">
                      Streak <span className="font-bold text-fg">{result.streak.current}d</span>
                      {" · "}
                      Today <span className="font-bold text-fg">{result.dailyScore} pts</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTutorDismissedFor(result.attemptId)}
                  className="rounded-btn border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-fg-muted hover:border-line-strong hover:text-fg"
                >
                  Close
                </button>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-fg-muted">
                That was a tricky one! Don&apos;t worry — making mistakes is how we learn!
                Our friendly AI Helper can walk you through it step by step so it makes total sense.
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <Link
                  ref={tutorCtaRef}
                  href={`/ask?prompt=${encodeURIComponent(tutorPrompt)}`}
                  className="inline-flex items-center justify-center rounded-btn bg-brand px-4 py-2.5 font-mono text-xs font-bold text-on-brand shadow-sm transition-all hover:bg-brand-strong"
                >
                  Ask AI Helper
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setTutorDismissedFor(result.attemptId);
                    setResult(null);
                  }}
                  className="rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-4"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => void loadNext(difficulty, topic)}
                  className="rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-4"
                >
                  Next Question
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
