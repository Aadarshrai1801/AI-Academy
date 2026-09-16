"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type HardQuestionEntry } from "@/lib/api";

/**
 * Daily hardest-questions board: the 10 toughest problems attempted since the
 * epoch reset (hard → medium → easy, then attempt volume). Server-ranked;
 * this component only renders. Public to view (`GET /leaderboard/top-questions`
 * returns rank metadata + truncated prompts, never answers); attempting a
 * listed question deep-links to `/practice?q=<id>`, which stays auth- and
 * quota-guarded server-side.
 */
const DIFFICULTY_STYLE: Record<HardQuestionEntry["difficulty"], string> = {
  hard: "border-[var(--diverged)]/40 bg-[var(--diverged)]/10 text-[var(--diverged)]",
  medium: "border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 text-[var(--tungsten)]",
  easy: "border-[var(--converged)]/40 bg-[var(--converged)]/10 text-[var(--converged)]",
};

export function HardestQuestions({ since }: { since?: string }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [questions, setQuestions] = useState<HardQuestionEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    let live = true;
    void getToken()
      .then((token) =>
        apiFetch<{ questions: HardQuestionEntry[] }>(
          `/leaderboard/top-questions${since ? `?since=${encodeURIComponent(since)}` : ""}`,
          { token },
        ),
      )
      .then((r) => {
        if (live) setQuestions(r.questions);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn, getToken, since]);

  if (!isLoaded) return null;

  return (
    <section id="daily-gauntlet" className="rounded-lg border border-[var(--seam)] bg-[var(--chassis)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--seam)] px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--ink-lead)]">
          <span className="text-[var(--tungsten)]">DAILY GAUNTLET //</span>
          <span>HARDEST QUESTIONS THIS EPOCH</span>
        </div>
        <span className="font-mono text-[10px] text-[var(--ink-lead)]">HARD → EASY · BY ATTEMPTS</span>
      </div>

      {failed && (
        <p className="px-4 py-6 text-xs text-[var(--ink-lead)]">
          Could not load the hardest-questions board. Try again after a refresh.
        </p>
      )}

      {!failed && questions === null && (
        <div className="flex items-center gap-3 px-4 py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--seam)] border-t-[var(--tungsten)]" />
          <p className="font-mono text-xs text-[var(--ink-lead)]">Ranking today&apos;s hardest questions…</p>
        </div>
      )}

      {!failed && questions !== null && questions.length === 0 && (
        <p className="px-4 py-6 text-xs text-[var(--ink-lead)]">
          No attempts yet today. Solve a problem and the hardest ones will surface here.
        </p>
      )}

      {!failed && questions !== null && questions.length > 0 && (
        <ol className="divide-y divide-[var(--seam)]">
          {questions.map((q) => {
            const href = isSignedIn ? `/practice?q=${encodeURIComponent(q.questionId)}` : "/sign-in";
            return (
              <li key={q.questionId}>
                <Link
                  href={href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--panel)]"
                >
                  <span className="w-7 flex-shrink-0 pt-0.5 font-mono text-xs text-[var(--ink-lead)] tabular-nums">
                    #{q.rank.toString().padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${DIFFICULTY_STYLE[q.difficulty]}`}
                      >
                        {q.difficulty}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ink-lead)]">{q.topic}</span>
                    </div>
                    {q.prompt && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--ink-chalk)]">
                        {q.prompt}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right font-mono text-[10px] text-[var(--ink-lead)]">
                    <div className="tabular-nums">{q.attemptCount} attempts</div>
                    <div className="tabular-nums">
                      {q.accuracy === null ? "—" : `${Math.round(q.accuracy * 100)}% solved`}
                    </div>
                    <span className="mt-0.5 rounded border border-[var(--seam)] px-1.5 py-0.5 text-[10px] text-[var(--tungsten)]">
                      {isSignedIn ? "Attempt →" : "Sign in →"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
