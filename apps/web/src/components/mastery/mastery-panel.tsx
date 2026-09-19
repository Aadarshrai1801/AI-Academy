"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Brain, GraduationCap, RefreshCw, Sparkles } from "lucide-react";
import {
  apiFetch,
  TOPIC_LABELS,
  type DiagnosticQuestion,
  type DiagnosticResult,
  type DiagnosticStatus,
  type MasteryResponse,
} from "@/lib/api";
import {
  Badge,
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DifficultyBadge,
  EmptyState,
  SkeletonText,
} from "@/components/ui";
import { CardSpotlight } from "@/components/ui/aceternity";
import { cn } from "@/lib/cn";

type Phase = "view" | "quiz" | "submitting" | "done";

/**
 * 7-day trajectory sparkline — real data, never decoration. Stroke hue encodes
 * direction (growth up / review down) and an sr-only label carries the same
 * information for screen readers, so color is never the only signal.
 */
function TrendLine({ trend, label }: { trend: number[]; label: string }) {
  const points = trend.slice(-7);
  if (points.length < 2) return null;
  const w = 64;
  const h = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const polyline = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((value - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = points[points.length - 1] >= points[0];
  return (
    <span className="inline-flex items-center" title={label}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={label}
        className="overflow-visible"
      >
        <polyline
          points={polyline}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={rising ? "stroke-growth" : "stroke-review"}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * One topic's row in "the path": label, trajectory, score, and a mastery bar
 * with a faint marker where the stored window started (the ghost). Struggling
 * topics read as focus areas in review amber — never a red list of failures.
 */
function MasteryRow({ topic }: { topic: MasteryResponse["topics"][number] }) {
  const label = TOPIC_LABELS[topic.topic] ?? topic.topic;
  const score = topic.score;
  const focus = score !== null && score < 40;
  const delta = topic.weekChange;
  const trendLabel =
    topic.trend.length >= 2
      ? `${delta !== null && delta !== 0 ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} points` : "Flat"} over the last week`
      : "Not enough history for a trend yet";

  return (
    <li className="surface-card px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{label}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {score === null
              ? "Not started — answer a question to begin"
              : focus
                ? "Focus area — short low-stakes sets work best here"
                : `${topic.attempts} attempt${topic.attempts === 1 ? "" : "s"} · ${Math.round(
                    (topic.accuracy ?? 0) * 100,
                  )}% correct`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <TrendLine trend={topic.trend} label={trendLabel} />
          {delta !== null && delta !== 0 && (
            <span
              className={cn(
                "font-mono text-xs font-semibold tabular-nums",
                delta > 0 ? "text-growth-ink" : "text-review-ink",
              )}
            >
              {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
            </span>
          )}
          {topic.recommendedDifficulty && (
            <span title="Recommended next difficulty">
              <DifficultyBadge difficulty={topic.recommendedDifficulty} />
            </span>
          )}
          <span className="font-mono text-sm font-semibold tabular-nums text-fg">
            {score === null ? "—" : score}
            <span className="text-fg-dim">/100</span>
          </span>
        </div>
      </div>

      <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-surface-4">
        {/* Ghost: where this topic stood at the start of the stored window. */}
        {topic.trend.length >= 2 && (topic.trend[0] ?? 0) > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 z-10 w-px bg-line-strong"
            style={{ left: `${Math.min(99, topic.trend[0])}%` }}
          />
        )}
        <div
          className={cn(
            "h-full origin-left rounded-full transition-[width] duration-500 ease-out",
            focus ? "bg-review" : "bg-growth",
          )}
          style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }}
        />
      </div>
    </li>
  );
}

/**
 * Learner progress dashboard (Phase 9): per-topic mastery from
 * `GET /users/me/mastery`, plus the one-shot placement quiz
 * (`GET/POST /mastery/diagnostic`) that seeds initial scores.
 */
export function MasteryPanel({ initial }: { initial: MasteryResponse | null }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<MasteryResponse | null>(initial);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("view");
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [quizSkipped, setQuizSkipped] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    const res = await apiFetch<MasteryResponse>("/users/me/mastery", { token });
    setData(res);
    setFailed(false);
  }, [getToken]);

  useEffect(() => {
    if (data || !isLoaded || !isSignedIn) return;
    let live = true;
    void getToken()
      .then((token) => apiFetch<MasteryResponse>("/users/me/mastery", { token }))
      .then((res) => {
        if (!live) return;
        setData(res);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [data, isLoaded, isSignedIn, getToken]);

  const startDiagnostic = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const token = await getToken();
      const status = await apiFetch<DiagnosticStatus>("/mastery/diagnostic", { token });
      if (status.completed) {
        await load();
        return;
      }
      setQuestions(status.questions ?? []);
      setAnswers({});
      setIndex(0);
      setResult(null);
      setPhase("quiz");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [getToken, load]);

  const submit = useCallback(async () => {
    setPhase("submitting");
    try {
      const token = await getToken();
      const payload = {
        answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })),
      };
      const res = await apiFetch<DiagnosticResult>("/mastery/diagnostic", {
        method: "POST",
        token,
        body: payload,
        idempotencyKey: crypto.randomUUID(),
      });
      setResult(res);
      setPhase("done");
      await load().catch(() => undefined);
    } catch {
      setPhase("quiz");
      setFailed(true);
    }
  }, [answers, getToken, load, questions]);

  if (!data) {
    return (
      <div className="space-y-4">
        {failed ? (
          <EmptyState
            icon={<Brain className="h-6 w-6 text-fg" />}
            title="Could not load your mastery yet"
            description="The API did not answer. Check that it is running, then retry."
            action={
              <Button variant="secondary" onClick={() => void startDiagnostic()} loading={busy}>
                Retry
              </Button>
            }
          />
        ) : (
          <CardSpotlight>
            <CardContent className="pt-5">
              <SkeletonText lines={6} />
            </CardContent>
          </CardSpotlight>
        )}
      </div>
    );
  }

  const current = questions[index];
  const answered = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  return (
    <div className="space-y-5">
      {/* Overview — the emotional payoff screen; the path below is its one
          bold element. Copy never frames low scores as failure. */}
      <CardSpotlight>
        <CardHeader>
          <div>
            <CardTitle>The path</CardTitle>
            <CardDescription>
              Scores move with every graded attempt and fade gently without review
              {data.decayHalfLifeDays ? ` (half-life ${data.decayHalfLifeDays} days)` : ""} — the
              sparklines show the last week&apos;s direction, not just today&apos;s number.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-2xl font-bold tabular-nums text-fg">
                {data.overall ?? "—"}
                <span className="text-sm text-fg-dim">/100</span>
              </p>
              <p className="text-[11px] text-fg-dim">overall</p>
            </div>
            {!data.diagnosticCompleted && !quizSkipped && (
              <Button
                onClick={() => void startDiagnostic()}
                loading={busy}
                leftIcon={<GraduationCap className="h-4 w-4" />}
              >
                Start placement · 2 min
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.diagnosticCompleted ? (
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-growth" />
              Placement measured — your scores started from the quiz and grow with practice.
            </p>
          ) : quizSkipped ? (
            <p className="text-xs text-fg-muted">
              Starting from the beginning. Placement is always available here whenever you want a
              level check.
            </p>
          ) : (
            <p className="text-xs text-fg-muted">
              New here? 8 questions tell us where to start you across all six topics — it&apos;s
              calibration, not a test, and wrong answers are useful.
            </p>
          )}
        </CardContent>
      </CardSpotlight>

      {/* Diagnostic flow — calibration framing: progress is visible, no score
          is shown mid-quiz, and skipping is always an option. */}
      {phase === "quiz" && current && (
        <CardSpotlight>
          <CardHeader>
            <div>
              <CardTitle>{TOPIC_LABELS[current.topic] ?? current.topic}</CardTitle>
              <CardDescription>
                Question {index + 1} of {questions.length} · we use these to start you at the right
                level — wrong answers just show us where to begin.
              </CardDescription>
            </div>
            <DifficultyBadge difficulty={current.difficulty} />
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-fg">{current.prompt}</p>

            {current.type === "mcq" && current.options ? (
              <div className="mt-4 grid gap-2">
                {current.options.map((option) => {
                  const selected = answers[current.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: option }))}
                      className={cn(
                        "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                        selected
                          ? "border-brand bg-brand-soft font-medium text-brand-ink"
                          : "border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : current.type === "code" ? (
              <textarea
                value={answers[current.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))}
                rows={4}
                aria-label="Your answer"
                placeholder="Type your answer…"
                className="mt-4 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-xs text-fg outline-none focus-visible:border-brand"
              />
            ) : (
              <input
                value={answers[current.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))}
                aria-label="Your answer"
                placeholder="Type your answer…"
                className="mt-4 w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-fg outline-none focus-visible:border-brand"
              />
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-fg-dim">
                {answered}/{questions.length} answered
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                >
                  Back
                </Button>
                {index < questions.length - 1 ? (
                  <Button
                    onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                    disabled={(answers[current.id] ?? "").trim().length === 0}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={() => void submit()}
                    disabled={!allAnswered}
                    leftIcon={<GraduationCap className="h-4 w-4" />}
                  >
                    Submit placement
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setPhase("view");
                  setQuizSkipped(true);
                }}
                className="text-xs text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
              >
                Skip for now — start from the beginning instead
              </button>
            </div>
          </CardContent>
        </CardSpotlight>
      )}

      {phase === "submitting" && (
        <CardSpotlight>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-fg-muted">
            <RefreshCw className="h-4 w-4 animate-spin" /> Grading your placement…
          </CardContent>
        </CardSpotlight>
      )}

      {phase === "done" && result && (
        <CardSpotlight>
          <CardHeader>
            <div>
              <CardTitle>Here&apos;s where you&apos;re starting</CardTitle>
              <CardDescription>
                {result.correct}/{result.total} correct — the path below reflects it. Misses told us
                where to begin, not what you can&apos;t do.
              </CardDescription>
            </div>
            <Badge variant="success">calibrated</Badge>
          </CardHeader>
          <CardContent>
            {result.seeded.length > 0 && (
              <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
                {result.seeded.map((row) => (
                  <li
                    key={row.topic}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"
                  >
                    <span className="text-fg">{TOPIC_LABELS[row.topic] ?? row.topic}</span>
                    <span className="font-mono tabular-nums text-fg-muted">
                      starting at {row.seedScore}/100
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => setPhase("view")}>See my path</Button>
          </CardContent>
        </CardSpotlight>
      )}

      {/* Topic rows */}
      <ul className="grid gap-3">
        {data.topics.map((topic) => (
          <MasteryRow key={topic.topic} topic={topic} />
        ))}
      </ul>
    </div>
  );
}
