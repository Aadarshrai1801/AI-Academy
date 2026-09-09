"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ApiError, TOPICS, apiFetch, type GenStatusDTO } from "@/lib/api";

const DIFFS = ["easy", "medium", "hard"] as const;

/** Admin overview: bank buffer vs target, queue depth, budget, top-up triggers. */
export default function AdminPage() {
  const { getToken, isLoaded } = useAuth();
  const [status, setStatus] = useState<GenStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await apiFetch<GenStatusDTO>("/admin/generation/status", {
        token: await getToken(),
      });
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? "Admin role required — promote your user first (see README)."
          : e instanceof Error
            ? `Could not load status: ${e.message}`
            : "Could not load status.",
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      // Initial load on auth-ready (intentional fetch-on-mount).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  async function ensureAll() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await apiFetch<{ enqueued: unknown[] }>("/admin/generation/ensure", {
        method: "POST",
        token: await getToken(),
        body: {},
      });
      setNotice(`Enqueued ${r.enqueued.length} top-up job(s).`);
      await load();
    } catch (e) {
      setNotice(
        e instanceof ApiError && e.status === 503
          ? "Generation queue offline — check REDIS_URL and restart the API. Bank still serves seeded questions."
          : e instanceof ApiError && e.status === 429
            ? "Daily budget spent — resets 00:00 UTC. Raise GENERATION_DAILY_BUDGET or wait."
            : e instanceof Error ? e.message : "Ensure failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cleanFailed() {
    setBusy(true);
    try {
      await apiFetch("/admin/generation/clean-failed", {
        method: "POST",
        token: await getToken(),
      });
      setNotice("Cleared failed jobs.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Clean failed.");
    } finally {
      setBusy(false);
    }
  }

  async function drainWaiting() {
    setBusy(true);
    try {
      await apiFetch("/admin/generation/drain-waiting", {
        method: "POST",
        token: await getToken(),
      });
      setNotice("Drained waiting jobs — press Top up for the 400 target.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Drain failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold">Admin · Question bank</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Phase 2 backfill control on <code className="font-mono">{status?.provider ?? "groq"}</code>.{" "}
        <Link href="/admin/review" className="underline">
          Review queue →
        </Link>{" "}
        <Link href="/admin/reports" className="underline">
          Reports →
        </Link>{" "}
        <Link href="/admin/analytics" className="underline">
          Platform →
        </Link>
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950">
          {error}
        </div>
      )}

      {status && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              { k: "Provider", v: status.provider },
              { k: "Buffer target", v: `${status.target}/combo` },
              { k: "Budget today", v: `${status.budget.used}/${status.budget.daily}` },
              {
                k: "Jobs (wait/active/fail)",
                v: status.jobs
                  ? `${status.jobs.waiting ?? 0}/${status.jobs.active ?? 0}/${status.jobs.failed ?? 0}`
                  : "n/a",
              },
            ].map((c) => (
              <div
                key={c.k}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="text-xs uppercase tracking-widest text-zinc-500">{c.k}</div>
                <div className="mt-1 font-semibold">{c.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="p-4">Topic</th>
                  {DIFFS.map((d) => (
                    <th key={d} className="p-4 capitalize">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOPICS.map((t) => (
                  <tr key={t} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="p-4 font-mono text-xs">{t}</td>
                    {DIFFS.map((d) => {
                      const cell = status.bank[t]?.[d] ?? { approved: 0, pending: 0 };
                      const low = cell.approved < status.target;
                      return (
                        <td key={d} className="p-4">
                          <span className={low ? "font-semibold text-amber-600" : ""}>
                            {cell.approved}
                          </span>
                          <span className="text-zinc-500">/{status.target}</span>
                          {cell.pending > 0 && (
                            <span className="ml-1 text-xs text-zinc-500">(+{cell.pending} pending)</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={ensureAll}
              disabled={busy}
              className="h-11 rounded-full bg-zinc-950 px-6 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {busy ? "Enqueuing…" : "Top up all buffers"}
            </button>
            {(status.jobs?.failed ?? 0) > 0 && (
              <button
                onClick={cleanFailed}
                disabled={busy}
                className="h-11 rounded-full border border-zinc-300 px-6 text-sm font-medium disabled:opacity-50"
              >
                Clear {status.jobs?.failed} failed
              </button>
            )}
            {(status.jobs?.waiting ?? 0) > 0 && (
              <button
                onClick={drainWaiting}
                disabled={busy}
                className="h-11 rounded-full border border-zinc-300 px-6 text-sm font-medium disabled:opacity-50"
              >
                Drain {status.jobs?.waiting} waiting
              </button>
            )}
            {notice && <p className="text-sm text-zinc-600 dark:text-zinc-400">{notice}</p>}
          </div>
        </>
      )}
    </main>
  );
}
