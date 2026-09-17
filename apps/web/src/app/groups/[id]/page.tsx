"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  ApiError,
  apiFetch,
  type CallDTO,
  type ChatMessage,
  type GroupBoardEntry,
  type GroupDTO,
  type QuestionDTO,
} from "@/lib/api";

const QUICK_EMOJI = ["👍", "🔥", "💡", "🤔", "👏"];
const POLL_FALLBACK_MS = 3000;

type Mode = { mode: "ably"; tokenRequest: unknown } | { mode: "polling"; intervalMs: number };

export default function GroupRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const myId = user?.id ?? "";

  const [group, setGroup] = useState<GroupDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<"connecting" | "ably" | "polling">("connecting");
  const [online, setOnline] = useState<number | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [board, setBoard] = useState<GroupBoardEntry[] | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeCall, setActiveCall] = useState<CallDTO | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const ablyRef = useRef<{ close: () => void; typing: () => void } | null>(null);
  const lastTyping = useRef(0);
  const lastSeenRef = useRef<string>("");
  const readMarkedRef = useRef<string>("");

  const mergeMessage = useCallback((m: ChatMessage) => {
    if (m.created_at > lastSeenRef.current) lastSeenRef.current = m.created_at;
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = [...prev];
      next[i] = m;
      return next;
    });
  }, []);

  const loadAll = useCallback(async () => {
    const token = await getToken();
    const [g, h, mode, calls] = await Promise.all([
      apiFetch<GroupDTO>(`/groups/${id}`, { token }),
      apiFetch<{ items: ChatMessage[] }>(`/groups/${id}/messages?limit=50`, { token }),
      apiFetch<Mode>("/realtime/token", { method: "POST", token }),
      apiFetch<{ active: CallDTO[] }>(`/calls?groupId=${id}`, { token }),
    ]);
    setGroup(g);
    setActiveCall(calls.active[0] ?? null);
    setMessages(h.items);
    for (const m of h.items) {
      if (m.created_at > lastSeenRef.current) lastSeenRef.current = m.created_at;
    }
    return mode;
  }, [getToken, id]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const mode = await loadAll();
        if (cancelled) return;
        if (mode.mode === "ably") {
          const Ably = await import("ably");
          const client = new Ably.Realtime({
            authCallback: (_params, callback) => {
              getToken()
                .then((t) => apiFetch<Mode>("/realtime/token", { method: "POST", token: t }))
                .then((m) =>
                  callback(
                    null,
                    m.mode === "ably" ? (m.tokenRequest as import("ably").TokenRequest) : null,
                  ),
                )
                .catch((e: unknown) =>
                  callback(e instanceof Error ? e.message : "realtime auth failed", null),
                );
            },
          });
          const channel = client.channels.get(`group:${id}`);
          await channel.attach();
          channel.subscribe("message", (msg) => mergeMessage(msg.data as ChatMessage));
          channel.subscribe("message-deleted", (msg) => {
            const data = msg.data as { id: string } | undefined;
            if (data) setMessages((prev) => prev.filter((x) => x.id !== data.id));
          });
          channel.subscribe("typing", (msg) => {
            const data = msg.data as { userId: string } | undefined;
            const uid = data?.userId;
            if (!uid || uid === myId) return;
            setTyping((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
            setTimeout(() => setTyping((prev) => prev.filter((u) => u !== uid)), 3000);
          });
          await channel.presence.enter();
          const snap = await channel.presence.get();
          if (!cancelled) {
            setOnline(snap.length);
            setLive("ably");
          }
          channel.presence.subscribe(() =>
            channel.presence.get().then((m) => !cancelled && setOnline(m.length)),
          );
          const me = myId;
          ablyRef.current = {
            close: () => void client.close(),
            typing: () => void channel.publish("typing", { userId: me }),
          };
        } else {
          setLive("polling");
          pollTimer = setInterval(async () => {
            try {
              const t = await getToken();
              const since = lastSeenRef.current || new Date(0).toISOString();
              const r = await apiFetch<{ items: ChatMessage[] }>(
                `/groups/${id}/messages?since=${encodeURIComponent(since)}`,
                { token: t },
              );
              r.items.forEach(mergeMessage);
            } catch {
              /* transient */
            }
          }, POLL_FALLBACK_MS);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not initialize study room.");
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      ablyRef.current?.close();
      ablyRef.current = null;
    };
  }, [isLoaded, id, getToken, loadAll, mergeMessage, myId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const last = messages[messages.length - 1];
    if (last && last.sender_id !== myId && readMarkedRef.current !== last.id) {
      readMarkedRef.current = last.id;
      void getToken().then((t) =>
        apiFetch(`/groups/${id}/messages/${last.id}/read`, {
          method: "POST",
          token: t,
        }).catch(() => undefined),
      );
    }
  }, [messages, getToken, id, myId]);

  async function send() {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    try {
      const m = await apiFetch<ChatMessage>(`/groups/${id}/messages`, {
        method: "POST",
        token: await getToken(),
        body: { content: text },
      });
      mergeMessage(m);
    } catch (e) {
      setDraft(text);
      setError(e instanceof Error ? e.message : "Message failed to send.");
    }
  }

  async function challenge() {
    try {
      const token = await getToken();
      const q = await apiFetch<QuestionDTO>("/questions/next", { token });
      const m = await apiFetch<ChatMessage>(`/groups/${id}/messages`, {
        method: "POST",
        token,
        body: { type: "question_share", questionId: q.id, content: q.prompt },
      });
      mergeMessage(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share question challenge.");
    }
  }

  async function react(id_: string, emoji: string) {
    try {
      const m = await apiFetch<ChatMessage>(`/groups/${id}/messages/${id_}/react`, {
        method: "POST",
        token: await getToken(),
        body: { emoji },
      });
      mergeMessage(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reaction failed.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      const m = await apiFetch<ChatMessage>(`/groups/${id}/messages/${editing.id}`, {
        method: "PATCH",
        token: await getToken(),
        body: { content: editing.text },
      });
      mergeMessage(m);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed.");
    }
  }

  async function remove(id_: string) {
    if (!confirm("Permanently delete this message?")) return;
    try {
      await apiFetch(`/groups/${id}/messages/${id_}`, {
        method: "DELETE",
        token: await getToken(),
      });
      setMessages((prev) => prev.filter((x) => x.id !== id_));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function report(id_: string) {
    const reason = prompt("Report reason:");
    if (!reason) return;
    try {
      await apiFetch(`/groups/${id}/messages/${id_}/report`, {
        method: "POST",
        token: await getToken(),
        body: { reason },
      });
      alert("Report submitted for review.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
    }
  }

  async function startCall() {
    try {
      const c = await apiFetch<CallDTO>("/calls/start", {
        method: "POST",
        token: await getToken(),
        body: { groupId: id },
      });
      router.push(`/calls/${c.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError && (e.payload.proRequired as boolean)
          ? "Hosting group study calls is a Pro feature. Upgrade to initiate video sessions."
          : e instanceof Error
            ? e.message
            : "Could not initiate call.",
      );
    }
  }

  async function loadBoard() {
    setShowBoard((s) => !s);
    if (board) return;
    try {
      const r = await apiFetch<{ entries: GroupBoardEntry[] }>(`/groups/${id}/leaderboard`, {
        token: await getToken(),
      });
      setBoard(r.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load group scores.");
    }
  }

  function onType(v: string) {
    setDraft(v);
    if (live === "ably" && Date.now() - lastTyping.current > 2500) {
      lastTyping.current = Date.now();
      ablyRef.current?.typing();
    }
  }

  const isOwner = group && myId && group.owner_id === myId;

  /**
   * Owner-only group deletion (soft delete server-side; retention policy
   * applies). Two-step arm-to-confirm so a misclick can't dissolve a cohort.
   * The API enforces ownership too — this button is just the affordance.
   */
  async function deleteGroup() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    try {
      await apiFetch(`/groups/${id}`, { method: "DELETE", token: await getToken() });
      router.push("/groups");
    } catch (e) {
      setDeleteArmed(false);
      setError(
        e instanceof ApiError && e.status === 403
          ? "Only the cohort owner can delete this group."
          : e instanceof Error
            ? `Could not delete group: ${e.message}`
            : "Could not delete group.",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
      {/* Group Room Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
            <Link href="/groups" className="hover:text-[var(--fg)] transition-colors">
              GROUPS
            </Link>
            <span className="text-[var(--line-strong)]">{"//"}</span>
            <span className="text-[var(--fg-muted)]">STUDY COHORT</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--fg)]">
            {group?.name ?? "Connecting…"}
          </h1>
        </div>

        {/* Telemetry & Controls */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-2.5 py-1 font-mono text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live === "ably"
                  ? "bg-success"
                  : live === "polling"
                  ? "bg-[var(--fg-muted)]"
                  : "bg-[var(--fg-dim)]"
              }`}
            />
            <span className="text-[var(--fg-muted)] uppercase tracking-wider">
              {live === "ably" ? `LIVE · ${online ?? 1} ACTIVE` : live}
            </span>
          </div>

          <button
            onClick={loadBoard}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-all ${
              showBoard
                ? "border-transparent bg-brand text-on-brand font-semibold shadow-sm"
                : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-[var(--fg)]"
            }`}
          >
            Scores
          </button>

          <button
            onClick={() => setShowInfo((s) => !s)}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-all ${
              showInfo
                ? "border-transparent bg-brand text-on-brand font-semibold shadow-sm"
                : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-[var(--fg)]"
            }`}
          >
            Cohort Info
          </button>
        </div>
      </div>

      {/* Live Call Banner */}
      {activeCall ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-line-strong bg-surface-2 p-3.5 text-xs text-fg shadow-card">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="font-mono font-semibold uppercase tracking-wider text-fg">
              LIVE STUDY CALL ACTIVE
            </span>
            <span className="font-mono text-[var(--fg-muted)]">
              ({activeCall.participant_ids.length} engineers in room)
            </span>
          </div>
          <Link
            href={`/calls/${activeCall.id}`}
            className="rounded-md border border-transparent bg-brand text-on-brand px-3.5 py-1.5 font-mono text-xs font-semibold transition-all hover:bg-brand-strong shadow-sm"
          >
            Join Call Room
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2 text-xs">
          <span className="font-mono text-[11px] text-[var(--fg-muted)]">
            No active video session in this cohort.
          </span>
          <button
            onClick={startCall}
            className="font-mono text-xs text-brand-ink hover:underline decoration-brand/40 underline-offset-4"
          >
            + Start group call (Pro)
          </button>
        </div>
      )}

      {/* Cohort Info Drawer */}
      {showInfo && group && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
            <span className="font-mono uppercase tracking-wider text-[var(--fg-dim)]">INVITE CODE:</span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-line-strong bg-surface-2 px-2.5 py-1 font-mono text-xs text-fg font-semibold">
                {group.invite_code}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(group.invite_code)}
                className="font-mono text-[var(--fg-muted)] underline hover:text-fg transition-colors"
              >
                copy
              </button>
            </div>
          </div>
          <div className="mt-3 text-[var(--fg-muted)] font-mono">
            Members: {group.member_count}/{group.max_members}
          </div>

          {/* Owner danger zone */}
          {isOwner ? (
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <button
                type="button"
                onClick={() => void deleteGroup()}
                onBlur={() => setDeleteArmed(false)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-all ${
                  deleteArmed
                    ? "animate-shake-x border-transparent bg-brand text-on-brand font-semibold shadow-sm"
                    : "border-line-strong text-fg-muted hover:border-brand hover:text-fg hover:bg-surface-3"
                }`}
              >
                {deleteArmed ? "Confirm — dissolve this cohort" : "Delete group"}
              </button>
              <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-[var(--fg-dim)]">
                {deleteArmed
                  ? "This dissolves the cohort for all members. Click again to confirm."
                  : "Only you, as owner, can dissolve this cohort."}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Group Scoreboard Drawer */}
      {showBoard && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 text-xs">
          <div className="border-b border-[var(--line)] pb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
            COHORT DAILY RANKINGS //
          </div>
          <div className="mt-2 divide-y divide-[var(--line)]">
            {(board ?? []).map((r) => (
              <div key={r.userId} className="flex items-center justify-between py-2 font-mono">
                <span className="text-[var(--fg-muted)]">
                  #{r.rank} · {r.userId === myId ? <span className="text-fg font-semibold">You</span> : `${r.userId.slice(0, 8)}…`}
                </span>
                <span className="font-semibold text-[var(--fg)] tabular-nums">
                  {r.score} pts
                </span>
              </div>
            ))}
            {board?.length === 0 && (
              <div className="py-2 text-[var(--fg-dim)] font-mono">
                No cohort points logged today. Solve questions to rank.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-3 rounded-lg border border-line-strong bg-surface-2 p-3 text-xs text-fg">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)] block mb-1">
            System Notice
          </span>
          {error}
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 min-h-[380px] max-h-[500px]">
        {messages.length === 0 ? (
          <div className="my-auto text-center font-mono text-xs text-[var(--fg-dim)]">
            Study group stream initialized. Share a problem candidate or say hello.
          </div>
        ) : null}

        {messages.map((m) => {
          const isMine = m.sender_id === myId;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-xl border p-3.5 text-xs transition-all ${
                isMine
                  ? "self-end border-line-strong bg-surface-3 text-fg shadow-card"
                  : "self-start border-[var(--line)] bg-[var(--surface-2)] text-[var(--fg)]"
              }`}
            >
              {/* Question Share Card */}
              {m.type === "question_share" && m.question_id ? (
                <div className="rounded-lg border border-line-strong bg-surface-2 p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
                    <span>COHORT PROBLEM CHALLENGE</span>
                    <span>#{m.question_id.slice(0, 6)}</span>
                  </div>
                  <p className="mt-2 font-medium leading-relaxed text-[var(--fg)]">
                    {m.content}
                  </p>
                  <div className="mt-3 border-t border-[var(--line)] pt-2">
                    <Link
                      href={`/practice?q=${m.question_id}`}
                      className="font-mono text-xs font-semibold text-fg hover:underline underline-offset-4"
                    >
                      Solve this problem with group →
                    </Link>
                  </div>
                </div>
              ) : editing?.id === m.id ? (
                <div>
                  <input
                    className="w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface-3)] p-2 font-mono text-xs text-[var(--fg)] focus-visible:border-brand focus-visible:outline-none"
                    value={editing.text}
                    onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                  />
                  <div className="mt-2 flex gap-2 font-mono text-[11px]">
                    <button onClick={saveEdit} className="text-fg hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditing(null)} className="text-[var(--fg-dim)] hover:underline">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
              )}

              {/* Message Telemetry & Reactions */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)]/50 pt-1.5 font-mono text-[10px] text-[var(--fg-dim)]">
                <div className="flex items-center gap-2">
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {m.edited_at && <span>(edited)</span>}
                  {m.read_by.length > 1 && <span>✓ {m.read_by.length - 1} read</span>}
                  {isMine ? (
                    <button
                      onClick={() => void remove(m.id)}
                      title="Delete message"
                      className="ml-1 text-[var(--fg-dim)] hover:text-fg transition-colors"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      onClick={() => void report(m.id)}
                      title="Report message"
                      className="ml-1 text-[var(--fg-dim)] hover:text-fg transition-colors"
                    >
                      ⚐
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {Object.entries(m.reactions).map(([e, users]) => (
                    <button
                      key={e}
                      onClick={() => react(m.id, e)}
                      className="rounded border border-[var(--line)] bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)] hover:border-line-strong hover:text-fg transition-colors"
                    >
                      {e} {users.length}
                    </button>
                  ))}
                  {QUICK_EMOJI.slice(0, 3).map((e) => (
                    <button
                      key={e}
                      onClick={() => react(m.id, e)}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicator */}
      {typing.length > 0 && (
        <div className="mt-1 font-mono text-[11px] text-[var(--fg-dim)] italic">
          Engineer typing…
        </div>
      )}

      {/* Composer Console */}
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Message cohort"
          className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 font-mono text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus-visible:border-brand focus-visible:outline-none transition-colors"
          placeholder="Send a message or code snippet…"
          value={draft}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={challenge}
          title="Share next practice question with cohort"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 py-1 font-mono text-xs text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-fg transition-all"
        >
          <span>⚔</span>
          <span className="hidden sm:inline">Share Problem</span>
        </button>
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="rounded-lg border border-transparent bg-brand text-on-brand px-4 py-1 font-mono text-xs font-semibold transition-all hover:bg-brand-strong disabled:opacity-30 shadow-sm"
        >
          Send
        </button>
      </div>
    </main>
  );
}
