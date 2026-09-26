"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { BookOpen, MessageSquare, Trophy } from "lucide-react";
import {
  ApiError,
  apiFetch,
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
    const [g, h, mode] = await Promise.all([
      apiFetch<GroupDTO>(`/groups/${id}`, { token }),
      apiFetch<{ items: ChatMessage[] }>(`/groups/${id}/messages?limit=50`, { token }),
      apiFetch<Mode>("/realtime/token", { method: "POST", token }),
    ]);
    setGroup(g);
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

  async function loadBoard() {
    setShowBoard((s) => !s);
    if (board) return;
    try {
      const r = await apiFetch<{ entries: GroupBoardEntry[]; mode?: "competitive" | "study" }>(
        `/groups/${id}/leaderboard`,
        { token: await getToken() },
      );
      setBoard(r.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load group scores.");
    }
  }

  /** Owner-only culture switch; study groups hide rankings. */
  async function setGroupMode(mode: "competitive" | "study") {
    if (!group || group.mode === mode) return;
    try {
      const updated = await apiFetch<GroupDTO>(`/groups/${id}/mode`, {
        method: "PATCH",
        token: await getToken(),
        body: { mode },
      });
      setGroup((g) => (g ? { ...g, mode: updated.mode } : g));
      setBoard(null);
      setShowBoard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the group mode.");
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
          <div className="flex items-center gap-2 text-xs text-fg-dim">
            <Link href="/groups" className="transition-colors hover:text-fg">
              Groups
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fg-muted">
              {group?.mode === "study" ? "Study group" : "Competitive group"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--fg)]">
              {group?.name ?? "Connecting…"}
            </h1>
            {group && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-1)] px-2.5 py-0.5 text-[11px] text-fg-muted"
                title={
                  group.mode === "study"
                    ? "Study mode: rankings are hidden and missed questions are shared"
                    : "Competitive mode: the daily group leaderboard is visible"
                }
              >
                {group.mode === "study" ? (
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Trophy className="h-3 w-3" aria-hidden="true" />
                )}
                {group.mode === "study" ? "Rankings off" : "Daily rankings"}
              </span>
            )}
          </div>
        </div>

        {/* Telemetry & Controls */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-2 rounded-btn border border-[var(--line)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live === "ably"
                  ? "bg-success"
                  : live === "polling"
                  ? "bg-[var(--fg-muted)]"
                  : "bg-[var(--fg-dim)]"
              }`}
            />
            <span className="text-[var(--fg-muted)]">
              {live === "ably" ? `live · ${online ?? 1} active` : live}
            </span>
          </div>

          <button
            onClick={loadBoard}
            className={`rounded-btn border px-2.5 py-1 text-xs transition-colors ${
              showBoard
                ? "border-transparent bg-brand font-semibold text-on-brand"
                : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-[var(--fg)]"
            }`}
          >
            {group?.mode === "study" ? "Study mode" : "Scores"}
          </button>

          <button
            onClick={() => setShowInfo((s) => !s)}
            className={`rounded-btn border px-2.5 py-1 text-xs transition-colors ${
              showInfo
                ? "border-transparent bg-brand font-semibold text-on-brand"
                : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-[var(--fg)]"
            }`}
          >
            Group Info
          </button>
        </div>
      </div>

      {/* Personalized Direct Messages Banner */}
      <div className="surface-card mt-3 flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-btn bg-brand-soft text-fg">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <div className="font-medium text-fg">Direct messages</div>
            <div className="text-[11px] text-fg-muted">
              Message any member 1:1 for practice challenges and study help.
            </div>
          </div>
        </div>
        <Link
          href="/messages"
          className="rounded-btn border border-transparent bg-brand px-3.5 py-1.5 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          Open messages
        </Link>
      </div>

      {/* Cohort Info Drawer */}
      {showInfo && group && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
            <span className="text-[11px] text-fg-dim">Invite code</span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-line-strong bg-surface-2 px-2.5 py-1 font-mono text-xs font-semibold text-fg">
                {group.invite_code}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(group.invite_code)}
                className="text-[var(--fg-muted)] underline transition-colors hover:text-fg"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[var(--fg-muted)]">
            <span>
              {group.member_count}/{group.max_members} members
            </span>
          </div>

          {isOwner && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-2.5">
              <div>
                <span className="block text-[11px] text-fg-dim">Group culture</span>
                <span className="text-[var(--fg-muted)]">
                  {group.mode === "study"
                    ? "Study — rankings hidden, missed questions shared for discussion"
                    : "Competitive — daily rankings visible to members"}
                </span>
              </div>
              <div className="flex gap-1.5" role="group" aria-label="Group culture">
                {(["competitive", "study"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={group.mode === m}
                    onClick={() => void setGroupMode(m)}
                    className={`rounded-btn border px-2.5 py-1 text-xs capitalize transition-colors ${
                      group.mode === m
                        ? "border-transparent bg-brand font-semibold text-on-brand"
                        : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {group.member_ids && group.member_ids.length > 0 && (
            <div className="mt-3 border-t border-[var(--line)] pt-2.5">
              <span className="mb-2 block text-[11px] text-fg-dim">
                Study partners — message anyone directly
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.member_ids.map((mid) =>
                  mid === myId ? null : (
                    <Link
                      key={mid}
                      href={`/messages?user=${mid}`}
                      className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg hover:border-brand hover:text-brand transition-all"
                    >
                      <MessageSquare className="h-3 w-3 text-brand" />
                      <span>Message Engineer {mid.slice(-4).toUpperCase()}</span>
                    </Link>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Owner danger zone */}
          {isOwner ? (
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <button
                type="button"
                onClick={() => void deleteGroup()}
                onBlur={() => setDeleteArmed(false)}
                className={`rounded-btn border px-3 py-1.5 text-xs transition-colors ${
                  deleteArmed
                    ? "animate-shake-x border-transparent bg-brand font-semibold text-on-brand"
                    : "border-line-strong text-fg-muted hover:border-brand hover:bg-surface-3 hover:text-fg"
                }`}
              >
                {deleteArmed ? "Confirm delete" : "Delete group"}
              </button>
              <p className="mt-1.5 text-[11px] leading-relaxed text-fg-dim">
                {deleteArmed
                  ? "This removes the group for all members. Click again to confirm."
                  : "Only you, as owner, can delete this group."}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Group Scoreboard Drawer */}
      {showBoard && group?.mode === "study" ? (
        <div className="surface-card mt-4 p-4 text-xs">
          <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
            <BookOpen className="h-3.5 w-3.5 text-fg-dim" aria-hidden="true" />
            <span className="text-sm font-semibold text-fg">Study mode — rankings off</span>
          </div>
          <p className="mt-2 leading-relaxed text-[var(--fg-muted)]">
            This group focuses on understanding, not ranking. When a member misses a practice
            question, it lands in the stream below for everyone to discuss — jump in and explain one.
          </p>
        </div>
      ) : showBoard && (
        <div className="surface-card mt-4 p-4 text-xs">
          <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
            <Trophy className="h-3.5 w-3.5 text-fg-dim" aria-hidden="true" />
            <span className="text-sm font-semibold text-fg">Group rankings · today</span>
          </div>
          <div className="mt-2 divide-y divide-[var(--line)]">
            {(board ?? []).map((r) => (
              <div key={r.userId} className="flex items-center justify-between py-2">
                <span className="text-[var(--fg-muted)]">
                  <span className="font-mono tabular-nums">#{r.rank}</span> ·{" "}
                  {r.userId === myId ? (
                    <span className="font-semibold text-fg">You</span>
                  ) : (
                    `Member ${r.userId.slice(-4).toUpperCase()}`
                  )}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-semibold tabular-nums text-[var(--fg)]">
                    {r.score} pts
                  </span>
                  {r.userId !== myId && (
                    <Link
                      href={`/messages?user=${r.userId}`}
                      className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-fg transition-colors hover:border-line-strong"
                    >
                      <MessageSquare className="h-2.5 w-2.5" />
                      Message
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {board?.length === 0 && (
              <div className="py-2 text-[var(--fg-dim)]">
                No points logged yet today — answering a question puts the first name on the board.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-3 rounded-card border border-error/40 bg-state-negative-soft p-3 text-xs text-fg">
          <span className="mb-1 block font-semibold text-state-negative-ink">
            Something went wrong
          </span>
          {error}
        </div>
      )}

      {/* Chat Messages Stream — bubbles encode direction in shape: the
          sender-side corner tightens so color is not the only cue. */}
      <div className="surface-card mt-4 flex min-h-[380px] max-h-[500px] flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="my-auto text-center text-xs text-fg-dim">
            {group?.mode === "study"
              ? "No messages yet. Missed questions from members show up here for discussion."
              : "No messages yet — say hello or share a question to challenge the group."}
          </div>
        ) : null}

        {messages.map((m) => {
          const isMine = m.sender_id === myId;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-card border p-3.5 text-xs ${
                isMine
                  ? "self-end rounded-br-[4px] border-line-strong bg-surface-3 text-fg"
                  : "self-start rounded-bl-[4px] border-[var(--line)] bg-[var(--surface-2)] text-[var(--fg)]"
              }`}
            >
              {/* Study-mode missed-question card */}
              {m.type === "study_prompt" && m.question_id ? (
                <div className="rounded-work border border-review/30 bg-review-soft p-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-review-ink">
                    <span>Missed question — worth discussing</span>
                    <span className="font-mono tabular-nums">#{m.question_id.slice(0, 6)}</span>
                  </div>
                  <p className="mt-2 font-medium leading-relaxed text-[var(--fg)]">{m.content}</p>
                  <div className="mt-3 border-t border-[var(--line)] pt-2">
                    <Link
                      href={`/practice?q=${m.question_id}`}
                      className="text-xs font-semibold text-fg underline underline-offset-4 hover:text-fg-muted"
                    >
                      Open in practice
                    </Link>
                  </div>
                </div>
              ) : m.type === "question_share" && m.question_id ? (
                <div className="rounded-work border border-line-strong bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-fg">
                    <span>Group problem</span>
                    <span className="font-mono tabular-nums text-fg-dim">
                      #{m.question_id.slice(0, 6)}
                    </span>
                  </div>
                  <p className="mt-2 font-medium leading-relaxed text-[var(--fg)]">
                    {m.content}
                  </p>
                  <div className="mt-3 border-t border-[var(--line)] pt-2">
                    <Link
                      href={`/practice?q=${m.question_id}`}
                      className="font-mono text-xs font-semibold text-fg hover:underline underline-offset-4"
                    >
                      Solve with Group
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
                      Delete
                    </button>
                  ) : (
                    <button
                      onClick={() => void report(m.id)}
                      title="Report message"
                      className="ml-1 text-[var(--fg-dim)] hover:text-fg transition-colors"
                    >
                      Report
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
          Typing…
        </div>
      )}

      {/* Composer Console */}
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Message group"
          className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 font-mono text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus-visible:border-brand focus-visible:outline-none transition-colors"
          placeholder="Send a message to your group…"
          value={draft}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={challenge}
          title="Share the next practice problem with your group"
          className="flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 py-1 font-mono text-xs text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-fg transition-all"
        >
          Share Problem
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
