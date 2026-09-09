"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch } from "@/lib/api";

/** Moderation inbox: reported chat messages + reported calls. */
export default function ReportsPage() {
  const { getToken, isLoaded } = useAuth();
  const [messages, setMessages] = useState<Array<{ id: string; content: string; sender_id: string; flag_reason?: string }>>([]);
  const [calls, setCalls] = useState<Array<{ _id: string; initiator_id: string; flag_reason?: string; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [m, c] = await Promise.all([
        apiFetch<{ items: Array<{ id: string; content: string; sender_id: string; flag_reason?: string }> }>(
          "/admin/reports?limit=50",
          { token },
        ),
        apiFetch<{ items: Array<{ _id: string; initiator_id: string; flag_reason?: string; status: string }> }>(
          "/admin/call-reports?limit=50",
          { token },
        ),
      ]);
      setMessages(m.items);
      setCalls(c.items);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? "Admin role required."
          : e instanceof Error
            ? `Could not load reports: ${e.message}`
            : "Load failed.",
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold">Admin · Reports</h1>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          {error}
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Messages ({messages.length})
        </h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <p>{m.content}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {m.sender_id} · {m.flag_reason ?? "no reason"}
              </p>
            </li>
          ))}
          {messages.length === 0 && <li className="text-sm text-zinc-500">Clear.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Calls ({calls.length})
        </h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {calls.map((c) => (
            <li key={c._id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <span className="font-mono text-xs">{c._id}</span> · {c.initiator_id} · {c.status} ·{" "}
              {c.flag_reason ?? "no reason"}
            </li>
          ))}
          {calls.length === 0 && <li className="text-sm text-zinc-500">Clear.</li>}
        </ul>
      </section>
    </main>
  );
}
