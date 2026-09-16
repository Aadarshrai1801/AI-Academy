"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type HardQuestionEntry } from "@/lib/api";
import { GauntletAttemptModal } from "@/components/gauntlet-attempt";

/**
 * Daily Gauntlet: the fixed 10-question set for the day, server-selected
 * across topics and refreshed at the 00:00 UTC reset — attemptable any time
 * until then, solved in place via `GauntletAttemptModal` with speed-scored
 * grading (fast solves earn more). Public to view
 * (`GET /leaderboard/top-questions` returns rank metadata + truncated prompts,
 * never answers).
 */
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
    <section id="daily-gauntlet" className="scroll-mt-20 rounded-card border border-line bg-surface-2 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
          <span className="text-brand">DAILY GAUNTLET //</span>
          <span>TODAY&apos;S SET</span>
        </div>
        <span className="font-mono text-[10px] text-fg-dim">Refreshed daily at 00:00 UTC</span>
      </div>

      {failed && (
        <p className="px-4 py-6 text-xs text-fg-muted">
          Could not load today&apos;s set. Try again after a refresh.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 px-4 py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="font-mono text-xs text-fg-muted">Assembling today&apos;s set…</p>
        </div>
      )}

      {!failed && questions !== null && questions.length === 0 && (
        <p className="px-4 py-6 text-xs leading-relaxed text-fg-muted">
          Today&apos;s gauntlet isn&apos;t ready yet — the question bank is empty. Check back soon.
        </p>
      )}

      {!failed && questions !== null && questions.length > 0 && (
        <ol className="divide-y divide-line">
          {questions.map((q) => {
            const row = (
              <>
                <span className="w-7 flex-shrink-0 pt-0.5 font-mono text-xs tabular-nums text-fg-dim">
                  #{q.rank.toString().padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                    {q.topic}
                  </span>
                  {q.prompt && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg">
                      {q.prompt}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right font-mono text-[10px] text-fg-muted">
                  <div className="tabular-nums">{q.attemptCount} attempts</div>
                  <div className="tabular-nums">
                    {q.accuracy === null ? "—" : `${Math.round(q.accuracy * 100)}% solved`}
                  </div>
                  <span className="mt-0.5 inline-flex items-center rounded border border-line px-1.5 py-0.5 text-[10px] text-brand">
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
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-3/60"
                  >
                    {row}
                  </button>
                ) : (
                  <Link
                    href="/sign-in"
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-3/60"
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
