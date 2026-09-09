"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ApiError, apiFetch, type GroupDTO } from "@/lib/api";

export default function GroupsPage() {
  const { getToken, isLoaded } = useAuth();
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ items: GroupDTO[] }>("/groups", {
        token: await getToken(),
      });
      setGroups(r.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? `Could not load cohorts: ${e.message}` : "Failed to load cohorts.");
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      void load();
    }
  }, [isLoaded, load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/groups", {
        method: "POST",
        token: await getToken(),
        body: { name: name.trim() },
      });
      setName("");
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? "Group creation limit reached on Free plan (1 active group). Upgrade to Pro for unlimited groups."
          : e instanceof Error
            ? e.message
            : "Could not create cohort.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/groups/join", {
        method: "POST",
        token: await getToken(),
        body: { code: code.trim() },
      });
      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join cohort with this invite code.");
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
          <span className="text-[var(--tungsten)]">STUDY COHORTS</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Study Groups
        </h1>
        <p className="mt-1 text-xs text-[var(--ink-lead)]">
          Solve question challenges together, discuss derivations in real-time chat, and initiate encrypted WebRTC study calls.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[var(--diverged)]/40 bg-[var(--diverged)]/10 p-4 text-xs text-[var(--ink-chalk)]">
          <div className="font-mono font-semibold text-[var(--diverged)]">Cohort notice</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Creation & Joining Controls */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Create Cohort */}
        <div className="rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-4">
          <div className="font-mono text-xs text-[var(--ink-lead)] uppercase">
            Create Study Cohort
          </div>
          <div className="mt-3 flex gap-2">
            <input
              aria-label="New group name"
              className="h-10 flex-1 rounded-md border border-[var(--seam)] bg-[var(--panel)] px-3 font-mono text-xs text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
              placeholder="e.g. Distributed LLM Reading Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <button
              onClick={create}
              disabled={busy || !name.trim()}
              className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>

        {/* Join by Code */}
        <div className="rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-4">
          <div className="font-mono text-xs text-[var(--ink-lead)] uppercase">
            Join with Invite Code
          </div>
          <div className="mt-3 flex gap-2">
            <input
              aria-label="Invite code"
              className="h-10 flex-1 rounded-md border border-[var(--seam)] bg-[var(--panel)] px-3 font-mono text-xs uppercase text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
              placeholder="e.g. A3F9B2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button
              onClick={join}
              disabled={busy || !code.trim()}
              className="rounded-md border border-[var(--seam)] bg-[var(--panel)] px-4 py-2 font-mono text-xs font-medium text-[var(--ink-chalk)] transition-colors hover:border-[var(--seam-highlight)] disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Cohorts List */}
      <div className="mt-8">
        <h2 className="font-mono text-xs text-[var(--ink-lead)]">
          YOUR ACTIVE COHORTS //
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="group flex items-center justify-between rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-4 transition-colors hover:border-[var(--seam-highlight)] hover:bg-[var(--panel)]"
            >
              <div>
                <div className="text-sm font-semibold text-[var(--ink-chalk)] group-hover:text-[var(--tungsten)]">
                  {g.name}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--ink-lead)]">
                  {g.member_count}/{g.max_members} engineers · {g.privacy}
                </div>
              </div>
              <span className="font-mono text-xs text-[var(--ink-lead)] group-hover:text-[var(--ink-chalk)]">
                Enter Room →
              </span>
            </Link>
          ))}
          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--seam)] p-8 text-center font-mono text-xs text-[var(--ink-lead)]">
              No active study cohorts found. Create a group or join with an invite code.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
