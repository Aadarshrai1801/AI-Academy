"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch, type CallDTO } from "@/lib/api";

/** My calls: active first, history below, 1:1 starter. */
export default function CallsPage() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<CallDTO[]>([]);
  const [items, setItems] = useState<CallDTO[]>([]);
  const [invitee, setInvitee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ active: CallDTO[]; items: CallDTO[] }>("/calls", {
        token: await getToken(),
      });
      setActive(r.active);
      setItems(r.items.filter((c) => c.status !== "active"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? `Could not load calls: ${e.message}` : "Load failed.");
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      void load();
    }
  }, [isLoaded, load]);

  async function start() {
    if (!invitee.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const c = await apiFetch<CallDTO>("/calls/start", {
        method: "POST",
        token: await getToken(),
        body: { inviteeId: invitee.trim() },
      });
      router.push(`/calls/${c.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? "Daily call duration cap reached on Free tier (15 min/day). Upgrade to Pro for unlimited duration."
          : e instanceof Error
            ? e.message
            : "Start call failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="border-b border-[var(--seam)] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span>COLLABORATIVE PROTOCOLS //</span>
          <span className="text-[var(--tungsten)]">ENCRYPTED CALLS</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Voice & Video Calls
        </h1>
        <p className="mt-1 text-xs text-[var(--ink-lead)]">
          Real-time peer-to-peer discussions, whiteboard architecture sessions, and technical study reviews.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[var(--diverged)]/40 bg-[var(--diverged)]/10 p-4 text-xs text-[var(--ink-chalk)]">
          <div className="font-mono font-semibold text-[var(--diverged)]">Call Notice</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-xs text-[var(--converged)] uppercase tracking-wider">
            Live Session Active
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {active.map((c) => (
              <Link
                key={c.id}
                href={`/calls/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--converged)]/50 bg-[var(--converged)]/5 p-4 text-xs font-medium text-[var(--ink-chalk)] hover:bg-[var(--converged)]/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--converged)] animate-pulse" />
                  <span>{c.type === "group" ? "Group Study Session" : "1:1 Technical Call"}</span>
                  <span className="text-[var(--ink-lead)]">({c.participant_ids.length} in room)</span>
                </div>
                <span className="font-mono text-[var(--converged)]">Join Call →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Start Call Form */}
      <div className="mt-6 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5">
        <h2 className="text-sm font-semibold text-[var(--ink-chalk)]">
          Initiate 1:1 Study Call
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-lead)]">
          Enter an engineer or study partner&apos;s ID to launch an encrypted WebRTC room.
        </p>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            aria-label="User ID to call"
            className="h-10 flex-1 rounded-md border border-[var(--seam)] bg-[var(--panel)] px-3 font-mono text-xs text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
            placeholder="Partner User ID…"
            value={invitee}
            onChange={(e) => setInvitee(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
          />
          <button
            onClick={start}
            disabled={busy || !invitee.trim()}
            className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Connecting…" : "Start Call"}
          </button>
        </div>
      </div>

      {/* History */}
      {items.length > 0 && (
        <section className="mt-8 border-t border-[var(--seam)] pt-6">
          <h2 className="font-mono text-xs text-[var(--ink-lead)]">
            RECENT CALL HISTORY //
          </h2>
          <div className="mt-3 flex flex-col divide-y divide-[var(--seam)] rounded-lg border border-[var(--seam)] bg-[var(--chassis)] overflow-hidden">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3.5 text-xs text-[var(--ink-chalk)] hover:bg-[var(--panel)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-[var(--tungsten)]">
                    {c.type === "group" ? "👥" : "📞"}
                  </span>
                  <span className="font-medium capitalize">{c.type} session</span>
                  {c.duration_sec ? (
                    <span className="font-mono text-[11px] text-[var(--ink-lead)]">
                      · {Math.round(c.duration_sec / 60)} min
                    </span>
                  ) : null}
                  {c.screen_share_used && (
                    <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-lead)]">
                      Screen Share
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-lead)]">
                  {c.started_at ? new Date(c.started_at).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
