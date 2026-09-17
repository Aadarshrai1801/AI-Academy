"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
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
  const [internalLoading, setInternalLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const loading = isLoaded && !isSignedIn ? false : internalLoading;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let live = true;
    async function load() {
      try {
        const token = await getToken();
        if (!token || !live) return;
        const res = await apiFetch<{ items: AttemptHistoryItem[] }>("/attempts/me?limit=15", { token });
        if (live) {
          setItems(res.items || []);
          setError(null);
        }
      } catch (err) {
        if (live) {
          setError(err instanceof Error ? err.message : "Failed to load practice history.");
        }
      } finally {
        if (live) setInternalLoading(false);
      }
    }

    void load();
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn, getToken, attemptCount]);

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
      <div className="mt-8 rounded-card border border-line bg-surface-2 p-6">
        <div className="flex items-center gap-2 font-mono text-xs text-fg-muted">
          <span className="h-2 w-2 rounded-full bg-success animate-ping" />
          <span>Synchronizing practice history…</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    if (!error) return null;
    return (
      <section className="mt-8 rounded-card border border-line bg-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
            Practice History
          </div>
          <button
            type="button"
            onClick={() => {
              setInternalLoading(true);
              setError(null);
              setAttemptCount((c) => c + 1);
            }}
            className="font-mono text-[11px] text-fg-muted hover:text-fg transition-colors"
          >
            Retry
          </button>
        </div>
        <div className="mt-3 rounded-md border border-line-strong bg-surface-3 p-2.5 text-xs text-fg-dim">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-card border border-line bg-surface-2 p-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
            Practice History
          </h2>
          <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 font-mono text-[10px] text-fg-muted">
            {items.length} records
          </span>
        </div>
        <button
          type="button"
          onClick={clearAllAttempts}
          className="font-mono text-[11px] text-fg-dim hover:text-fg transition-colors"
        >
          Clear History
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-line-strong bg-surface-3 p-2.5 text-xs text-fg-dim">
          {error}
        </div>
      )}

      <div className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                  item.isCorrect
                    ? "border border-line-strong bg-surface-3 text-fg shadow-xs"
                    : "border border-dashed border-line bg-surface-2 text-fg-dim"
                }`}
              >
                {item.isCorrect ? "PASS" : "FAIL"}
              </span>

              <div className="truncate">
                <div className="font-mono text-xs font-medium text-fg capitalize truncate">
                  {item.topic.replace(/-/g, " ")}
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-fg-dim">
                  <span className="capitalize">{item.difficulty}</span>
                  <span>·</span>
                  <span className={item.points > 0 ? "font-semibold text-fg" : ""}>
                    {item.points > 0 ? `+${item.points} pts` : "0 pts"}
                  </span>
                  <span>·</span>
                  <span>{(item.timeTakenMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-fg-dim hidden sm:inline">
                {item.at ? new Date(item.at).toLocaleDateString() : item.day}
              </span>
              <button
                type="button"
                title="Delete attempt record"
                disabled={deletingId === item.id}
                onClick={(e) => deleteAttempt(e, item.id)}
                className="p-1.5 rounded-md text-fg-dim hover:text-fg hover:bg-surface-4 transition-colors disabled:opacity-50"
                aria-label="Delete practice attempt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
