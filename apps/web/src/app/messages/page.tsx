"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCheck,
  Edit2,
  Flag,
  Flame,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  apiFetch,
  type ChatMessage,
  type ConversationDTO,
  type DirectHistoryResponse,
  type DirectPartnerDTO,
  type PeerDTO,
  type QuestionDTO,
} from "@/lib/api";
import { displayName, useUserDirectory } from "@/components/collab/presence";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";
import { Badge, Button, EmptyState, SkeletonRow } from "@/components/ui";
import { cn } from "@/lib/cn";

const QUICK_EMOJIS = ["👍", "🔥", "💡", "❤️", "👏"];
const POLL_FALLBACK_MS = 3000;

type Mode = { mode: "ably"; tokenRequest: unknown } | { mode: "polling"; intervalMs: number };

function formatTimeAgo(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoDate).toLocaleDateString();
  } catch {
    return "";
  }
}

function userHue(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 360;
  }
  return hash;
}

function UserAvatar({
  userId,
  name,
  size = "md",
}: {
  userId: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const hue = userHue(userId);
  const sizeClasses = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
  }[size];

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border font-mono font-bold shadow-xs",
        sizeClasses,
      )}
      style={{
        backgroundColor: `hsl(${hue} 70% 95%)`,
        borderColor: `hsl(${hue} 60% 80%)`,
        color: `hsl(${hue} 80% 30%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function DirectMessagesContent() {
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const myId = user?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramUser = searchParams.get("user");
  const directory = useUserDirectory();

  const [conversations, setConversations] = useState<ConversationDTO[] | null>(null);
  const [peers, setPeers] = useState<PeerDTO[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(paramUser);
  const [activePartner, setActivePartner] = useState<DirectPartnerDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string>("");
  const lastTypingRef = useRef<number>(0);
  const ablyRef = useRef<{ close: () => void; typing: () => void } | null>(null);

  // Sync paramUser to activePartnerId if searchParam changes
  useEffect(() => {
    if (paramUser && paramUser !== activePartnerId) {
      queueMicrotask(() => {
        setActivePartnerId(paramUser);
      });
    }
  }, [paramUser, activePartnerId]);

  // Load conversations list and suggested peers
  const loadConversations = useCallback(async () => {
    try {
      const token = await getToken();
      const [convosRes, peersRes] = await Promise.all([
        apiFetch<{ conversations: ConversationDTO[] }>("/messages/conversations", { token }).catch(
          () => ({ conversations: [] }),
        ),
        apiFetch<{ peers: PeerDTO[] }>("/messages/peers", { token }).catch(() => ({ peers: [] })),
      ]);
      setConversations(convosRes.conversations);
      setPeers(peersRes.peers);
    } catch {
      setConversations([]);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    queueMicrotask(() => {
      void loadConversations();
    });
  }, [isLoaded, loadConversations]);

  // Load message history with active partner
  const loadHistory = useCallback(
    async (partnerId: string) => {
      try {
        const token = await getToken();
        const res = await apiFetch<DirectHistoryResponse>(`/messages/direct/${partnerId}?limit=50`, {
          token,
        });
        setMessages(res.items);
        setActivePartner(res.partner);
        for (const m of res.items) {
          if (m.created_at > lastSeenRef.current) lastSeenRef.current = m.created_at;
        }
        // Update unread count in conversations state
        setConversations((prev) =>
          prev
            ? prev.map((c) =>
                c.partner.id === partnerId ? { ...c, unreadCount: 0 } : c,
              )
            : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load messages.");
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!activePartnerId) {
      queueMicrotask(() => {
        setActivePartner(null);
        setMessages([]);
      });
      return;
    }
    lastSeenRef.current = "";
    queueMicrotask(() => {
      void loadHistory(activePartnerId);
    });
  }, [isLoaded, activePartnerId, loadHistory]);

  const mergeMessage = useCallback((m: ChatMessage) => {
    if (m.created_at > lastSeenRef.current) lastSeenRef.current = m.created_at;
    setMessages((prev) => {
      const index = prev.findIndex((x) => x.id === m.id);
      if (index === -1) return [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = [...prev];
      next[index] = m;
      return next;
    });
  }, []);

  // Realtime subscription or polling for active DM conversation
  useEffect(() => {
    if (!isLoaded || !activePartnerId || !myId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const conversationId = [myId, activePartnerId].sort().join(":");

    (async () => {
      try {
        const token = await getToken();
        const mode = await apiFetch<Mode>("/realtime/token", { method: "POST", token }).catch(
          () => ({ mode: "polling", intervalMs: POLL_FALLBACK_MS } as Mode),
        );

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

          const channel = client.channels.get(`dm:${conversationId}`);
          await channel.attach();

          channel.subscribe("message", (msg) => {
            mergeMessage(msg.data as ChatMessage);
          });
          channel.subscribe("message-deleted", (msg) => {
            const data = msg.data as { id: string } | undefined;
            if (data) setMessages((prev) => prev.filter((x) => x.id !== data.id));
          });
          channel.subscribe("typing", (msg) => {
            const data = msg.data as { userId: string } | undefined;
            const uid = data?.userId;
            if (!uid || uid === myId) return;
            setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
            setTimeout(() => setTypingUsers((prev) => prev.filter((u) => u !== uid)), 3000);
          });

          ablyRef.current = {
            close: () => void client.close(),
            typing: () => void channel.publish("typing", { userId: myId }),
          };
        } else {
          pollTimer = setInterval(async () => {
            try {
              const t = await getToken();
              const since = lastSeenRef.current || new Date(0).toISOString();
              const r = await apiFetch<DirectHistoryResponse>(
                `/messages/direct/${activePartnerId}?since=${encodeURIComponent(since)}`,
                { token: t },
              );
              r.items.forEach(mergeMessage);
            } catch {
              /* transient */
            }
          }, POLL_FALLBACK_MS);
        }
      } catch {
        /* best effort */
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      ablyRef.current?.close();
      ablyRef.current = null;
    };
  }, [isLoaded, activePartnerId, myId, getToken, mergeMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string, type: "text" | "question_share" | "study_prompt" = "text", questionId?: string) {
    if (!content.trim() || !activePartnerId || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const token = await getToken();
      const m = await apiFetch<ChatMessage>(`/messages/direct/${activePartnerId}`, {
        method: "POST",
        token,
        body: { content: content.trim(), type, questionId },
      });
      mergeMessage(m);
      setDraft("");
      void loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function sharePracticeChallenge() {
    if (!activePartnerId || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const token = await getToken();
      const q = await apiFetch<QuestionDTO>("/questions/next", { token });
      await sendMessage(
        `⚡ Practice Challenge: ${q.prompt}`,
        "question_share",
        q.id,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load challenge.");
      setIsSending(false);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!activePartnerId) return;
    try {
      const token = await getToken();
      const updated = await apiFetch<ChatMessage>(
        `/messages/direct/${activePartnerId}/${messageId}/react`,
        {
          method: "POST",
          token,
          body: { emoji },
        },
      );
      mergeMessage(updated);
    } catch {
      /* best effort */
    }
  }

  async function saveEdit() {
    if (!editingMessage || !activePartnerId) return;
    try {
      const token = await getToken();
      const updated = await apiFetch<ChatMessage>(
        `/messages/direct/${activePartnerId}/${editingMessage.id}`,
        {
          method: "PATCH",
          token,
          body: { content: editingMessage.text },
        },
      );
      mergeMessage(updated);
      setEditingMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not edit message.");
    }
  }

  async function deleteMessage(messageId: string) {
    if (!activePartnerId) return;
    try {
      const token = await getToken();
      await apiFetch(`/messages/direct/${activePartnerId}/${messageId}`, {
        method: "DELETE",
        token,
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete message.");
    }
  }

  async function submitReport() {
    if (!reportMessageId || !activePartnerId || !reportReason.trim()) return;
    setReportBusy(true);
    try {
      const token = await getToken();
      await apiFetch(`/messages/direct/${activePartnerId}/${reportMessageId}/report`, {
        method: "POST",
        token,
        body: { reason: reportReason.trim() },
      });
      setReportMessageId(null);
      setReportReason("");
      alert("Report submitted for moderation.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
    } finally {
      setReportBusy(false);
    }
  }

  function handleInputChange(val: string) {
    setDraft(val);
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
      ablyRef.current?.typing();
    }
  }

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!filterQuery.trim()) return conversations;
    const q = filterQuery.toLowerCase();
    return conversations.filter((c) => {
      const name = c.partner.username ?? displayName(c.partner.id, directory);
      return (
        name.toLowerCase().includes(q) ||
        (c.lastMessage?.content ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filterQuery, directory]);

  const activePartnerName = useMemo(() => {
    if (!activePartnerId) return "";
    return activePartner?.username ?? displayName(activePartnerId, directory);
  }, [activePartner, activePartnerId, directory]);

  const totalUnread = useMemo(() => {
    return (conversations ?? []).reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
  }, [conversations]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Direct Messaging</span>
            <span className="text-fg-muted">{"//"}</span>
            <span>Study Buddies</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl flex items-center gap-2">
            <span>Direct Messages</span>
            {totalUnread > 0 && (
              <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] text-on-brand font-bold">
                {totalUnread} new
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-fg-muted max-w-xl">
            1:1 personalized chat with peers. Share practice challenges, exchange hints, and learn together.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/groups"
            className="font-mono text-xs text-brand hover:underline underline-offset-4 flex items-center gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Find Study Groups</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line-strong bg-surface-2 p-3 text-xs text-fg">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[10px] text-fg-muted hover:text-fg"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Messaging Layout */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-12 min-h-[640px]">
        {/* Left Sidebar: Conversations & Buddy Picker (4 cols on lg) */}
        <div
          className={cn(
            "lg:col-span-4 flex flex-col space-y-4",
            activePartnerId ? "hidden lg:flex" : "flex",
          )}
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-fg-dim" />
            <input
              type="text"
              placeholder="Search chats or peers…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 font-mono text-xs text-fg placeholder:text-fg-dim focus:border-brand focus:outline-none"
            />
          </div>

          {/* Quick Study Buddies discovery chips */}
          {peers.length > 0 && (
            <div className="rounded-xl border border-line bg-surface-1 p-3">
              <div className="flex items-center justify-between pb-2 mb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-brand" />
                  Study Partners
                </span>
                <span className="font-mono text-[10px] text-fg-dim">{peers.length} available</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                {peers.map((peer) => {
                  const name = peer.username || displayName(peer.id, directory);
                  const isSelected = activePartnerId === peer.id;
                  return (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => {
                        setActivePartnerId(peer.id);
                        router.push(`/messages?user=${peer.id}`);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 shrink-0 rounded-lg p-2 transition-all text-center min-w-[72px]",
                        isSelected
                          ? "bg-brand/10 border border-brand/40 ring-1 ring-brand/30"
                          : "border border-transparent bg-surface-2 hover:border-line hover:bg-surface-3",
                      )}
                    >
                      <UserAvatar userId={peer.id} name={name} size="sm" />
                      <span className="truncate max-w-[68px] text-[10px] font-medium text-fg">
                        {name}
                      </span>
                      <span className="font-mono text-[9px] text-fg-dim flex items-center gap-0.5">
                        <Flame className="h-2.5 w-2.5 text-amber-500" />
                        {peer.current_streak}d
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversations List */}
          <div className="flex-1 rounded-xl border border-line bg-surface-1 p-2 flex flex-col min-h-[380px]">
            <div className="px-2 py-1.5 border-b border-line mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                Recent Chats
              </span>
              <span className="font-mono text-[10px] text-fg-dim">
                {conversations?.length ?? 0} conversations
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {conversations === null && (
                <div className="space-y-2 p-2">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {conversations !== null && filteredConversations.length === 0 && (
                <div className="py-12 text-center">
                  <EmptyState
                    compact
                    icon={<MessageSquare className="h-5 w-5" />}
                    title={filterQuery ? "No matches found" : "No chats yet"}
                    description={
                      filterQuery
                        ? "Try searching for a different username."
                        : "Pick a study partner above to start a 1:1 chat."
                    }
                  />
                </div>
              )}

              {filteredConversations.map((convo) => {
                const isSelected = activePartnerId === convo.partner.id;
                const partnerName =
                  convo.partner.username || displayName(convo.partner.id, directory);
                const hasUnread = (convo.unreadCount ?? 0) > 0;

                return (
                  <button
                    key={convo.conversationId}
                    type="button"
                    onClick={() => {
                      setActivePartnerId(convo.partner.id);
                      router.push(`/messages?user=${convo.partner.id}`);
                    }}
                    className={cn(
                      "w-full text-left rounded-lg p-2.5 transition-all flex items-center gap-3",
                      isSelected
                        ? "bg-surface-3 border border-brand/30 shadow-xs"
                        : "hover:bg-surface-2 border border-transparent",
                    )}
                  >
                    <UserAvatar userId={convo.partner.id} name={partnerName} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-semibold text-xs text-fg">
                            {partnerName}
                          </span>
                          {convo.partner.role === "pro" && (
                            <Badge variant="outline" size="sm" className="text-[9px] px-1 py-0">
                              PRO
                            </Badge>
                          )}
                        </div>
                        {convo.updated_at && (
                          <span className="font-mono text-[10px] text-fg-dim shrink-0">
                            {formatTimeAgo(convo.updated_at)}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate font-mono text-[11px] text-fg-muted">
                          {convo.lastMessage?.type === "question_share"
                            ? "🎯 Practice Challenge"
                            : convo.lastMessage?.content || "No messages yet"}
                        </p>
                        {hasUnread && (
                          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[9px] font-bold text-on-brand shrink-0">
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Area: Active Chat or Welcome Hero (8 cols on lg) */}
        <div
          className={cn(
            "lg:col-span-8 flex flex-col rounded-xl border border-line bg-surface-1 overflow-hidden",
            activePartnerId ? "flex" : "hidden lg:flex",
          )}
        >
          {activePartnerId ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActivePartnerId(null)}
                    className="lg:hidden rounded-md p-1 hover:bg-surface-3 text-fg-muted hover:text-fg"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <UserAvatar userId={activePartnerId} name={activePartnerName} size="md" />

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-fg">{activePartnerName}</h2>
                      {activePartner?.role === "pro" && (
                        <Badge variant="outline" size="sm" className="text-[9px]">
                          PRO
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-fg-dim">
                      <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                        <Flame className="h-3 w-3" />
                        {activePartner?.current_streak ?? 0} streak
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5 text-fg-muted">
                        <Trophy className="h-3 w-3" />
                        {activePartner?.points_total ?? 0} pts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void sharePracticeChallenge()}
                    disabled={isSending}
                    className="font-mono text-xs"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500 mr-1" />
                    Challenge
                  </Button>
                </div>
              </div>

              {/* Personalized Study Buddy Action Card (Pinned at Top of Chat) */}
              <div className="border-b border-line bg-surface-2/30 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-brand" />
                    Personalized Study Prompts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        void sendMessage(
                          `Hey ${activePartnerName}! How did you approach today's practice question?`,
                          "study_prompt",
                        )
                      }
                      className="rounded-full border border-line bg-surface-1 px-2.5 py-0.5 font-mono text-[10px] text-fg hover:border-brand hover:text-brand transition-all"
                    >
                      💡 Ask about today&apos;s problem
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void sendMessage(
                          `Great ${activePartner?.current_streak ?? 0}-day streak! Ready to solve today's challenge together?`,
                          "study_prompt",
                        )
                      }
                      className="rounded-full border border-line bg-surface-1 px-2.5 py-0.5 font-mono text-[10px] text-fg hover:border-brand hover:text-brand transition-all"
                    >
                      🔥 Streak check-in
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[360px]">
                {messages.length === 0 ? (
                  <div className="py-16 text-center">
                    <CardSpotlight className="mx-auto max-w-md p-6 border-line text-center">
                      <UserAvatar userId={activePartnerId} name={activePartnerName} size="lg" />
                      <h3 className="mt-3 text-sm font-bold text-fg">
                        Start your personalized study chat with {activePartnerName}
                      </h3>
                      <p className="mt-1 font-mono text-xs text-fg-muted">
                        Send a message, challenge each other with a practice question, or discuss solutions.
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void sharePracticeChallenge()}
                        >
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          Send Practice Challenge
                        </Button>
                      </div>
                    </CardSpotlight>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === myId;
                    const reactions = Object.entries(m.reactions || {});

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "group relative flex flex-col max-w-[82%]",
                          isMe ? "ml-auto items-end" : "mr-auto items-start",
                        )}
                      >
                        {/* Bubble */}
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-xs transition-colors",
                            isMe
                              ? "bg-brand text-on-brand rounded-br-xs shadow-xs"
                              : "bg-surface-2 border border-line text-fg rounded-bl-xs shadow-xs",
                          )}
                        >
                          {/* Message Content */}
                          {editingMessage?.id === m.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingMessage.text}
                                onChange={(e) =>
                                  setEditingMessage({ id: m.id, text: e.target.value })
                                }
                                className="w-full rounded border border-line bg-surface-1 p-1.5 font-mono text-xs text-fg outline-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-1 font-mono text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setEditingMessage(null)}
                                  className="px-2 py-0.5 text-fg-muted hover:text-fg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveEdit()}
                                  className="rounded bg-brand px-2 py-0.5 text-on-brand font-semibold"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : m.type === "question_share" ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                                <Zap className="h-3 w-3" />
                                <span>Practice Challenge</span>
                              </div>
                              <p className="leading-relaxed font-mono text-[11px]">{m.content}</p>
                              <Link
                                href="/practice"
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors",
                                  isMe
                                    ? "bg-surface-1 text-fg hover:bg-surface-2"
                                    : "bg-brand text-on-brand hover:bg-brand-strong",
                                )}
                              >
                                Solve in Practice →
                              </Link>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed break-words">
                              {m.content}
                            </p>
                          )}

                          {m.edited_at && (
                            <span className="block mt-1 font-mono text-[9px] opacity-70">
                              (edited)
                            </span>
                          )}
                        </div>

                        {/* Reactions Row */}
                        {reactions.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {reactions.map(([emoji, userIds]) => {
                              const iReacted = userIds.includes(myId);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void toggleReaction(m.id, emoji)}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-all",
                                    iReacted
                                      ? "border-brand/40 bg-brand/10 text-fg"
                                      : "border-line bg-surface-2 text-fg-muted hover:border-line-strong",
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span>{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Metadata & Hover Actions */}
                        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-fg-dim">
                          <span>{formatTimeAgo(m.created_at)}</span>
                          {isMe && (
                            <span className="flex items-center gap-0.5 text-fg-muted">
                              <CheckCheck className="h-3 w-3 text-brand" />
                            </span>
                          )}

                          {/* Hover action toolbar */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <div className="flex items-center rounded border border-line bg-surface-2 px-1">
                              {QUICK_EMOJIS.map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={() => void toggleReaction(m.id, e)}
                                  className="p-1 hover:scale-125 transition-transform"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>

                            {isMe && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingMessage({ id: m.id, text: m.content })
                                  }
                                  className="rounded p-1 hover:bg-surface-2 text-fg-dim hover:text-fg"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(m.id)}
                                  className="rounded p-1 hover:bg-surface-2 text-fg-dim hover:text-fg"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}

                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => setReportMessageId(m.id)}
                                className="rounded p-1 hover:bg-surface-2 text-fg-dim hover:text-fg"
                                title="Report message"
                              >
                                <Flag className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 font-mono text-[11px] text-fg-dim italic">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-ping" />
                    <span>{activePartnerName} is typing…</span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-line bg-surface-2/70 p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage(draft);
                  }}
                  className="flex items-center gap-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void sharePracticeChallenge()}
                    title="Send a Practice Challenge question"
                    className="shrink-0 text-amber-500 hover:text-amber-600"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>

                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={`Message ${activePartnerName}… (Enter to send)`}
                    className="h-10 flex-1 rounded-lg border border-line bg-surface-1 px-3.5 font-mono text-xs text-fg placeholder:text-fg-dim focus:border-brand focus:outline-none"
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!draft.trim() || isSending}
                    className="shrink-0 h-10 px-4"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
            /* Welcome Hero When No Chat Selected */
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/20 bg-brand/10 text-brand mb-4 shadow-sm">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-fg">Personalized Direct Messages</h2>
              <p className="mt-1.5 max-w-md font-mono text-xs text-fg-muted leading-relaxed">
                Connect 1:1 with study partners. Practice questions together, share hints, compare
                streaks, and stay motivated.
              </p>

              {peers.length > 0 && (
                <div className="mt-6 w-full max-w-sm rounded-xl border border-line bg-surface-2 p-4 text-left">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim mb-2.5">
                    Recommended Study Buddies //
                  </div>
                  <div className="space-y-2">
                    {peers.slice(0, 4).map((peer) => {
                      const name = peer.username || displayName(peer.id, directory);
                      return (
                        <div
                          key={peer.id}
                          className="flex items-center justify-between rounded-lg border border-line bg-surface-1 p-2 transition-colors hover:border-line-strong"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar userId={peer.id} name={name} size="sm" />
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-medium text-fg">
                                {name}
                              </span>
                              <span className="block font-mono text-[10px] text-fg-dim">
                                {peer.viaGroup || "AI Academy"}
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setActivePartnerId(peer.id);
                              router.push(`/messages?user=${peer.id}`);
                            }}
                            className="font-mono text-xs"
                          >
                            Message
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Moderation Report Dialog */}
      <AnimatePresence>
        {reportMessageId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-xl border border-line bg-surface-1 p-5 shadow-xl">
              <h3 className="text-sm font-bold text-fg">Report Message</h3>
              <p className="mt-1 font-mono text-xs text-fg-muted">
                Describe why you are reporting this message (abuse, spam, harassment).
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Reason…"
                className="mt-3 w-full rounded-lg border border-line bg-surface-2 p-2.5 font-mono text-xs text-fg outline-none focus:border-brand"
              />
              <div className="mt-4 flex justify-end gap-2 font-mono text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportMessageId(null)}
                  disabled={reportBusy}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void submitReport()}
                  disabled={reportBusy || !reportReason.trim()}
                >
                  {reportBusy ? "Submitting…" : "Submit Report"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      }
    >
      <DirectMessagesContent />
    </Suspense>
  );
}
