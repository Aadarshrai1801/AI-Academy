"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type HardQuestionEntry } from "@/lib/api";
import { GauntletAttemptModal } from "@/components/gauntlet-attempt";

/**
 * Daily Gauntlet: the fixed 10-question set for the day (hardest-first,
 * server-selected). Deterministic per day and refreshed at the 00:00 UTC
 * reset — attemptable any time until then, solved in place via
 * `GauntletAttemptModal` with speed-scored grading (fast solves earn more).
 * Public to view (`GET /leaderboard/top-questions` returns rank metadata +
 * truncated prompts, never answers).
 */
const DIFFICULTY_STYLE: Record<HardQuestionEntry["difficulty"], string> = {
  hard: "border-[var(--diverged)]/40 bg-[var(--diverged)]/10 text-[var(--diverged)]",
  medium: "border-[var(--tungsten)]/40 bg-[var(--tungsten)]/10 text-[var(--tungsten)]",
  easy: "border-[var(--converged)]/40 bg-[var(--converged)]/10 text-[var(--converged)]",
};

export function HardestQuestions({ date }: { date?: string }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<HardQuestionEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let live = true;
    setQuestions(null);
    setFailed(false);
    void getToken()
      .then((token) =>
        apiFetch<{ questions: HardQuestionEntry[] }>(
          `/leaderboard/top-questions${date ? `?date=${encodeURIComponent(date)}` : ""}`,
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
  }, [isLoaded, isSignedIn, getToken, date, refreshKey]);

  // A graded attempt changes attempts/scores: refresh the board + the
  // server-rendered scoreboard above without a full page reload.
  const handleGraded = useCallback(() => {
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  // NOTE: the section shell always renders (even before Clerk/auth resolves)
  // so the `#daily-gauntlet` anchor target always exists in the DOM.
  const loading = !isLoaded || (!failed && questions === null);

  return (
    <section id="daily-gauntlet" className="scroll-mt-20 rounded-lg border border-[var(--seam)] bg-[var(--chassis)]">
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

      {loading && (
        <div className="flex items-center gap-3 px-4 py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--seam)] border-t-[var(--tungsten)]" />
          <p className="font-mono text-xs text-[var(--ink-lead)]">Ranking today&apos;s hardest questions…</p>
        </div>
      )}

      {!failed && questions !== null && questions.length === 0 && (
        <p className="px-4 py-6 text-xs leading-relaxed text-[var(--ink-lead)]">
          Today&apos;s gauntlet isn&apos;t ready yet — the question bank is empty. Check back soon.
        </p>
      )}

      {!failed && questions !== null && questions.length > 0 && (
        <ol className="divide-y divide-[var(--seam)]">
          {questions.map((q) => {
            const row = (
              <>
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
                  <span className="mt-0.5 inline-flex items-center rounded border border-[var(--seam)] px-1.5 py-0.5 text-[10px] text-[var(--tungsten)]">
                    {isSignedIn ? "Solve" : "Sign in"}
                  </span>
                </div>
              </>
            );
            return (
              <li key={q.questionId}>
                {isSignedIn ? (
                  <button
                    type="button"
                    onClick={() => setActiveId(q.questionId)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--panel)]"
                  >
                    {row}
                  </button>
                ) : (
                  <Link
                    href="/sign-in"
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--panel)]"
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {activeId && (
        <GauntletAttemptModal
          questionId={activeId}
          onClose={() => setActiveId(null)}
          onGraded={handleGraded}
        />
      )}
    </section>
  );
}
