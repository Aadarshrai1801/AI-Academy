"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export interface AttemptHistoryItem {
  id: string;
  questionId: string;
  difficulty: string;
  topic: string;
  isCorrect: boolean;
  points: number;
  timeTakenMs: number;
  day: string;
  at: string;
}

export function PracticeHistory() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<{ items: AttemptHistoryItem[] }>("/attempts/me?limit=15", { token });
      setItems(res.items || []);
      setError(null);
    } catch (err) {
      // Don't console.error here: Next.js dev overlay surfaces it as a crash.
      // Store a friendly message and render it inline instead.
      setError(err instanceof Error ? err.message : "Failed to load practice history.");
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchHistory();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchHistory]);

  async function deleteAttempt(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch(`/attempts/${id}`, { method: "DELETE", token });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete attempt record.");
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAllAttempts() {
    if (!window.confirm("Delete all practice history records from database?")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch("/attempts/me/all", { method: "DELETE", token });
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear practice history.");
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span className="h-2 w-2 rounded-full bg-[var(--tungsten)] animate-ping" />
          <span>Synchronizing practice history…</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    if (!error) return null;
    return (
      <section className="mt-8 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-xs font-semibold text-[var(--ink-lead)]">
            PRACTICE HISTORY //
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              void fetchHistory();
            }}
            className="font-mono text-[11px] text-[var(--ink-lead)] hover:text-[var(--tungsten)] transition-colors"
          >
            Retry
          </button>
        </div>
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5">
      <div className="flex items-center justify-between border-b border-[var(--seam)] pb-3">
        <div className="flex items-center gap-2">
          <div className="font-mono text-xs font-semibold text-[var(--ink-lead)]">
            PRACTICE HISTORY //
          </div>
          <span className="rounded bg-[var(--panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--tungsten)]">
            {items.length} records
          </span>
        </div>
        <button
          type="button"
          onClick={clearAllAttempts}
          className="font-mono text-[11px] text-[var(--ink-lead)] hover:text-red-400 transition-colors"
        >
          Clear History
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="mt-3 divide-y divide-[var(--seam)] overflow-hidden rounded-md border border-[var(--seam)] bg-[var(--panel)]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-[var(--chassis)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  item.isCorrect
                    ? "bg-[var(--converged)]/10 text-[var(--converged)] border border-[var(--converged)]/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}
              >
                {item.isCorrect ? "PASS" : "FAIL"}
              </span>

              <div className="truncate">
                <div className="font-mono text-xs font-medium text-[var(--ink-chalk)] capitalize truncate">
                  {item.topic.replace(/-/g, " ")}
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--ink-lead)]">
                  <span className="capitalize">{item.difficulty}</span>
                  <span>·</span>
                  <span>{item.points > 0 ? `+${item.points} pts` : "0 pts"}</span>
                  <span>·</span>
                  <span>{(item.timeTakenMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono text-[11px] text-[var(--ink-lead)] hidden sm:inline">
                {item.at ? new Date(item.at).toLocaleDateString() : item.day}
              </span>
              <button
                type="button"
                title="Delete attempt from database"
                disabled={deletingId === item.id}
                onClick={(e) => deleteAttempt(e, item.id)}
                className="p-1.5 rounded text-[var(--ink-lead)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                aria-label="Delete practice attempt"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
