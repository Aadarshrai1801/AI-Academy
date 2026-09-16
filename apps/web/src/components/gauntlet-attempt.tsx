"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch, type AttemptResultDTO, type QuestionDTO } from "@/lib/api";

/**
 * In-place gauntlet solver: loads one board question (`GET /questions/:id`,
 * auth- + quota-guarded server-side) and grades it (`POST /attempts`) without
 * leaving `/leaderboard`. Stays mounted as a modal dialog over the board.
 */
export function GauntletAttemptModal({
  questionId,
  onClose,
  onGraded,
}: {
  questionId: string;
  onClose: () => void;
  onGraded: () => void;
}) {
  const { getToken } = useAuth();
  const [question, setQuestion] = useState<QuestionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ limit: number; resetAt?: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResultDTO | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setPaywall(null);
    setResult(null);
    setAnswer("");
    setElapsed(0);
    void getToken()
      .then((token) => apiFetch<QuestionDTO>(`/questions/${questionId}`, { token }))
      .then((q) => {
        if (!live) return;
        setQuestion(q);
        startedAt.current = Date.now();
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 429) {
          setPaywall({
            limit: (e.payload.limit as number) ?? 10,
            resetAt: e.payload.resetAt as string | undefined,
          });
        } else {
          setError(e instanceof Error ? e.message : "Could not load question.");
        }
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [questionId, getToken]);

  useEffect(() => {
    if (!question || result || loading) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [question, result, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!question || !answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const r = await apiFetch<AttemptResultDTO>("/attempts", {
        method: "POST",
        token,
        body: {
          questionId: question.id,
          answer: answer.trim(),
          timeTakenMs: Math.max(1000, Date.now() - startedAt.current),
        },
      });
      setResult(r);
      onGraded();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setPaywall({
          limit: (e.payload.limit as number) ?? 10,
          resetAt: e.payload.resetAt as string | undefined,
        });
      } else {
        setError(e instanceof Error ? e.message : "Submission evaluation failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const mm = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Solve gauntlet question"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--ink-lead)]">
            <span className="text-[var(--tungsten)]">DAILY GAUNTLET //</span>
            <span>SOLVE IN PLACE</span>
            {question && !result && (
              <span className="tabular-nums">
                {mm}:{ss}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-[var(--seam)] px-2 py-0.5 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--seam)] border-t-[var(--tungsten)]" />
            <p className="font-mono text-xs text-[var(--ink-lead)]">Loading question…</p>
          </div>
        )}

        {!loading && paywall && (
          <div className="py-6">
            <div className="inline-flex items-center gap-2 rounded bg-[var(--tungsten)]/10 px-2 py-0.5 font-mono text-xs text-[var(--tungsten)]">
              <span>EPOCH QUOTA COMPLETE</span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-[var(--ink-chalk)]">
              Daily practice limit reached ({paywall.limit}/day)
            </h3>
            <p className="mt-1 text-xs text-[var(--ink-lead)]">
              Replenishes daily at 00:00 UTC
              {paywall.resetAt ? ` (resets at ${new Date(paywall.resetAt).toLocaleTimeString()})` : ""}.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/pricing"
                className="rounded bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-on-brand hover:opacity-90"
              >
                Upgrade Plan
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[var(--seam)] px-4 py-2 font-mono text-xs text-[var(--ink-chalk)]"
              >
                Back to board
              </button>
            </div>
          </div>
        )}

        {!loading && error && !paywall && (
          <div className="mt-4 rounded border border-[var(--diverged)]/30 bg-[var(--diverged)]/5 p-4 text-xs text-[var(--ink-chalk)]">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[var(--seam)] px-3 py-1.5 text-xs text-[var(--ink-chalk)]"
              >
                Back to board
              </button>
            </div>
          </div>
        )}

        {!loading && question && !paywall && !result && (
          <div className="mt-4">
            <p className="text-sm font-medium leading-relaxed text-[var(--ink-chalk)]">{question.prompt}</p>
            {question.type === "mcq" && question.options ? (
              <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
                {question.options.map((opt, idx) => {
                  const selected = answer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAnswer(opt)}
                      className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-xs transition-all ${
                        selected
                          ? "border-[var(--tungsten)] bg-[var(--tungsten)]/10 text-[var(--ink-chalk)]"
                          : "border-[var(--seam)] bg-[var(--panel)] text-[var(--ink-lead)] hover:border-[var(--seam-highlight)] hover:text-[var(--ink-chalk)]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border font-mono text-[11px] font-semibold ${
                          selected
                            ? "border-[var(--tungsten)] bg-[var(--tungsten)] text-on-brand"
                            : "border-[var(--seam-highlight)] text-[var(--ink-lead)]"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="leading-5 text-[var(--ink-chalk)]">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                aria-label="Your answer"
                className="mt-4 min-h-32 w-full rounded-md border border-[var(--seam)] bg-[var(--panel)] p-3 font-mono text-xs leading-5 text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
                placeholder="Provide mathematical expression or computational argument…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}
            <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--seam)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--seam)] px-4 py-2 text-xs font-medium text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!answer.trim() || submitting}
                className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 text-xs font-semibold text-on-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Grading…" : "Submit answer"}
              </button>
            </div>
          </div>
        )}

        {!loading && result && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              result.isCorrect
                ? "border-[var(--converged)]/40 bg-[var(--converged)]/5"
                : "border-[var(--diverged)]/40 bg-[var(--diverged)]/5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-sm font-semibold text-[var(--ink-chalk)]">
                {result.isCorrect ? "CONVERGED — ACCURATE" : "DIVERGED — FAILED CONSTRAINTS"}
              </h3>
              <span className="font-mono text-xs text-[var(--ink-chalk)] tabular-nums">
                +{result.pointsAwarded} pts
              </span>
            </div>
            {!result.isCorrect && (
              <div className="mt-3 rounded border border-[var(--diverged)]/30 bg-[var(--diverged)]/10 p-3 text-xs text-[var(--ink-chalk)]">
                <span className="font-mono font-medium text-[var(--diverged)]">Correct Solution: </span>
                <span>{result.correctAnswer}</span>
              </div>
            )}
            <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-chalk)]">
              {result.explanation}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--seam)] pt-3 font-mono text-[11px] text-[var(--ink-lead)]">
              <span>
                Daily Score: <strong className="text-[var(--ink-chalk)] tabular-nums">{result.dailyScore}</strong> · Streak:{" "}
                <strong className="text-[var(--tungsten)] tabular-nums">{result.streak.current}d</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-1.5 font-mono text-xs font-semibold text-on-brand hover:opacity-90"
              >
                Back to board
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
