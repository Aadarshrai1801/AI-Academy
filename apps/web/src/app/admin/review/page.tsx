"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch, type ReviewItem } from "@/lib/api";

/** Human-in-the-loop review queue for flagged/low-confidence generations. */
export default function ReviewPage() {
  const { getToken, isLoaded } = useAuth();
  const [filter, setFilter] = useState("pending_review");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (f: string) => {
      try {
        const r = await apiFetch<{ items: ReviewItem[] }>(
          `/admin/review?status=${f}&limit=25`,
          { token: await getToken() },
        );
        setItems(r.items);
        setError(null);
      } catch (e) {
        setError(
          e instanceof ApiError && e.status === 403
            ? "Admin role required — promote your user first (see README)."
            : e instanceof Error
              ? `Could not load queue: ${e.message}`
              : "Could not load queue.",
        );
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load(filter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  async function decide(id: string, status: "approved" | "flagged") {
    setBusy(id);
    try {
      await apiFetch(`/admin/review/${id}`, {
        method: "PATCH",
        token: await getToken(),
        body: { status },
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold">Admin · Review queue</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/admin" className="underline">
          ← Bank overview
        </Link>{" "}
        · Approving publishes to the practice pool; flagging hides from serving.
      </p>

      <div className="mt-4 flex gap-2">
        {(["pending_review", "flagged"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              void load(f);
            }}
            className={`h-10 rounded-full px-5 text-sm ${
              filter === f
                ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {f === "pending_review" ? "Pending" : "Flagged"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950">
          {error}
        </div>
      )}

      {items.length === 0 && !error && (
        <p className="mt-6 text-sm text-zinc-500">Queue empty — nothing to review.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {items.map((q) => (
          <article
            key={q.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-500">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{q.difficulty}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{q.topic}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{q.type}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{q.generation_model}</span>
              {typeof q.quality_score === "number" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900">
                  score {q.quality_score.toFixed(2)}
                </span>
              )}
            </div>
            <p className="mt-3 font-medium">{q.prompt}</p>
            {q.options && (
              <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {q.options.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm">
              Answer: <strong>{q.correct_answer}</strong>
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{q.explanation}</p>
            {q.flag_reason && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Flag: {q.flag_reason}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => decide(q.id, "approved")}
                disabled={busy === q.id}
                className="h-10 rounded-full bg-green-700 px-5 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide(q.id, "flagged")}
                disabled={busy === q.id}
                className="h-10 rounded-full border border-red-400 px-5 text-sm text-red-700 disabled:opacity-50 dark:text-red-300"
              >
                Flag
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
