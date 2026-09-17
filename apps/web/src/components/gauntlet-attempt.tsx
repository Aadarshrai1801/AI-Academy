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
    async function load() {
      try {
        const token = await getToken();
        if (!live) return;
        const q = await apiFetch<QuestionDTO>(`/questions/${questionId}`, { token });
        if (live) {
          setQuestion(q);
          startedAt.current = Date.now();
          setLoading(false);
        }
      } catch (e) {
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
      }
    }
    void load();
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
      <div className="fixed inset-0 bg-[#18181B]/75 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Solve gauntlet question"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card border border-line-strong bg-surface-2 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2 font-mono text-[11px] text-fg-dim">
            <span className="font-semibold text-fg">DAILY CHALLENGE {"//"}</span>
            <span>QUESTION</span>
            {question && !result && (
              <span className="tabular-nums font-semibold text-fg">
                {mm}:{ss}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-btn border border-line bg-surface-3 px-3 py-1 font-mono text-xs text-fg-muted hover:border-line-strong hover:bg-surface-4 hover:text-fg transition-colors"
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-fg" />
            <p className="font-mono text-xs text-fg-muted">Loading question…</p>
          </div>
        )}

        {!loading && paywall && (
          <div className="py-6">
            <div className="inline-flex items-center gap-2 rounded border border-line-strong bg-surface-3 px-2 py-0.5 font-mono text-xs font-semibold text-fg">
              <span>DAILY PRACTICE COMPLETE</span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-fg">
              Daily practice limit reached ({paywall.limit}/day)
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              Resets tomorrow
              {paywall.resetAt ? ` (${new Date(paywall.resetAt).toLocaleTimeString()})` : ""}.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/pricing"
                className="rounded-btn border border-transparent bg-brand text-on-brand px-4 py-2 font-mono text-xs font-semibold shadow-sm hover:bg-brand-strong transition-all"
              >
                Upgrade Plan
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs text-fg hover:border-line-strong hover:bg-surface-4 transition-colors"
              >
                Back to Board
              </button>
            </div>
          </div>
        )}

        {!loading && error && !paywall && (
          <div className="mt-4 rounded-md border border-line-strong bg-surface-3 p-4 text-xs text-fg">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn border border-line bg-surface-4 px-3 py-1.5 text-xs text-fg hover:border-line-strong"
              >
                Back to Board
              </button>
            </div>
          </div>
        )}

        {!loading && question && !paywall && !result && (
          <div className="mt-4">
            <p className="text-sm font-medium leading-relaxed text-fg">{question.prompt}</p>
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
                      className={`flex w-full items-start gap-3 rounded-card border p-3 text-left text-xs transition-all ${
                        selected
                          ? "border-brand bg-brand-soft text-fg ring-1 ring-brand/30 shadow-sm"
                          : "border-line bg-surface-1 text-fg-muted hover:border-line-strong hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-[11px] font-semibold transition-all ${
                          selected
                            ? "border-brand bg-brand text-on-brand font-bold shadow-xs"
                            : "border-line bg-surface-3 text-fg-dim"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="leading-5 text-fg">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                aria-label="Your answer"
                className="mt-4 min-h-32 w-full rounded-card border border-line bg-surface-1 p-3 font-mono text-xs leading-5 text-fg placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none transition-all"
                placeholder="Type your answer or explanation here…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}
            <div className="mt-4 flex items-center justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn border border-line bg-surface-3 px-4 py-2 text-xs font-medium text-fg hover:border-line-strong hover:bg-surface-4 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!answer.trim() || submitting}
                className="rounded-btn border border-transparent bg-brand text-on-brand px-5 py-2 text-xs font-semibold shadow-sm transition-all hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Checking…" : "Submit Answer"}
              </button>
            </div>
          </div>
        )}

        {!loading && result && (
          <div
            className={`mt-4 rounded-card border p-4 ${
              result.isCorrect
                ? "border-success/40 bg-state-positive-soft shadow-sm"
                : "border-dashed border-error/40 bg-state-negative-soft"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-sm font-semibold text-fg">
                {result.isCorrect ? "Correct! Great Job!" : "Not Quite Right — Keep Trying!"}
              </h3>
              <span className="font-mono text-xs font-bold text-fg tabular-nums">
                +{result.pointsAwarded} pts
              </span>
            </div>
            {!result.isCorrect && (
              <div className="mt-3 rounded-md border border-line-strong bg-surface-3 p-3 text-xs text-fg">
                <span className="font-mono font-semibold text-fg">The Right Answer: </span>
                <span className="text-fg-muted">{result.correctAnswer}</span>
              </div>
            )}
            <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
              {result.explanation}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 font-mono text-[11px] text-fg-dim">
              <span>
                Daily Score: <strong className="text-fg tabular-nums">{result.dailyScore}</strong> · Streak:{" "}
                <strong className="text-fg tabular-nums">{result.streak.current}d</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn border border-transparent bg-brand text-on-brand px-4 py-1.5 font-mono text-xs font-semibold shadow-sm hover:bg-brand-strong transition-all"
              >
                Back to Board
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
