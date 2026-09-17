"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, MonitorUp, Phone, PhoneCall, Users, Video } from "lucide-react";
import { ApiError, apiFetch, type CallDTO, type GroupDTO } from "@/lib/api";
import { LiveDot, displayName, useUserDirectory } from "@/components/collab/presence";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SkeletonRow,
  buttonStyles,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

interface CallHistoryResponse {
  active: CallDTO[];
  items: CallDTO[];
}

export default function CallsPage() {
  const { getToken, isLoaded, userId } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();
  const directory = useUserDirectory();

  const [active, setActive] = useState<CallDTO[]>([]);
  const [items, setItems] = useState<CallDTO[] | null>(null);
  const [partners, setPartners] = useState<Array<{ id: string; via: string }>>([]);
  const [invitee, setInvitee] = useState("");
  const [connecting, setConnecting] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);

  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [calls, groups] = await Promise.all([
        apiFetch<CallHistoryResponse>("/calls", { token }),
        apiFetch<{ items: GroupDTO[] }>("/groups", { token }).catch(() => ({ items: [] })),
      ]);
      setActive(calls.active);
      setItems(calls.items.filter((call) => call.status !== "active"));
      setError(null);

      const seen = new Map<string, string>();
      for (const group of groups.items) {
        for (const member of group.member_ids ?? []) {
          if (member === userId) continue;
          if (!seen.has(member)) seen.set(member, group.name);
        }
      }
      setPartners([...seen.entries()].map(([id, via]) => ({ id, via })));
    } catch (e) {
      setError(e instanceof Error ? `Could not load calls: ${e.message}` : "Load failed.");
      setItems([]);
    }
  }, [getToken, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    queueMicrotask(() => {
      void load();
    });
  }, [isLoaded, load]);

  async function start(partnerId: string, partnerName: string) {
    if (!partnerId.trim() || connecting) return;
    cancelled.current = false;
    setConnecting({ id: partnerId, name: partnerName });
    setError(null);
    try {
      const token = await getToken();
      const call = await apiFetch<CallDTO>("/calls/start", {
        method: "POST",
        token,
        body: { inviteeId: partnerId.trim() },
      });
      if (cancelled.current) return;
      router.push(`/calls/${call.id}`);
    } catch (e) {
      if (cancelled.current) return;
      setError(
        e instanceof ApiError && e.status === 429
          ? "Daily call cap reached (15 min/day on Free). It resets tomorrow."
          : e instanceof Error
            ? e.message
            : "Start call failed.",
      );
      setConnecting(null);
    }
  }

  async function deleteCall(id: string) {
    try {
      const token = await getToken();
      await apiFetch(`/calls/${id}`, { method: "DELETE", token });
      setItems((prev) => (prev ? prev.filter((c) => c.id !== id) : []));
      setArmedDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete call failed.");
    }
  }

  async function clearHistory() {
    try {
      const token = await getToken();
      await apiFetch("/calls/history/all", { method: "DELETE", token });
      setItems([]);
      setClearArmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear history failed.");
    }
  }

  const partnerRows = useMemo(() => partners.slice(0, 8), [partners]);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Audio &amp; Video</span>
            <span className="text-fg-muted">{"//"}</span>
            <span>Study Calls</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">
            Study Calls
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            Voice and screen-share sessions to solve puzzles together and help each other learn.
          </p>
        </div>

        <Badge variant="outline" className="font-mono text-[11px]">
          15 min/day free quota
        </Badge>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line-strong bg-surface-2 p-3 text-xs text-fg shadow-card">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[10px] text-fg-muted hover:text-fg"
          >
            Dismiss →
          </button>
        </div>
      )}

      {/* Active Calls Notice */}
      <AnimatePresence>
        {active.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="space-y-2">
              {active.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-card border border-line-strong bg-surface-3 p-4 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <LiveDot label="Call in progress" />
                    <span className="font-medium text-sm text-fg">
                      {call.type === "group" ? "Group study session" : "1:1 study call"}
                    </span>
                    <span className="font-mono text-xs text-fg-muted">
                      ({call.participant_ids.length} active)
                    </span>
                  </div>

                  <Link
                    href={`/calls/${call.id}`}
                    className="rounded-btn border border-transparent bg-brand text-on-brand px-4 py-1.5 font-mono text-xs font-semibold shadow-sm hover:bg-brand-strong transition-all"
                  >
                    Rejoin Room →
                  </Link>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Connecting Dialler Overlay */}
      <AnimatePresence mode="wait">
        {connecting && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            className="mt-6"
          >
            <CardSpotlight className="border-line-strong p-8 text-center shadow-card">
              <div className="flex flex-col items-center gap-4">
                <span className="relative grid h-20 w-20 place-items-center">
                  {!reduced &&
                    [0, 1, 2].map((ring) => (
                      <motion.span
                        key={ring}
                        className="absolute h-16 w-16 rounded-full border-2 border-brand/30"
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          delay: ring * 0.45,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  <span className="relative grid h-16 w-16 place-items-center rounded-full border border-transparent bg-brand text-on-brand font-mono text-base font-bold shadow-sm">
                    {connecting.name.slice(0, 2).toUpperCase()}
                  </span>
                </span>

                <div>
                  <h3 className="text-base font-bold text-fg">Connecting to {connecting.name}</h3>
                  <p className="mt-1 font-mono text-xs text-fg-muted">
                    Connecting to voice server, almost ready…
                  </p>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    cancelled.current = true;
                    setConnecting(null);
                  }}
                >
                  Cancel Call →
                </Button>
              </div>
            </CardSpotlight>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Symmetrical Split: Call Dispatcher + Partners & History */}
      {!connecting && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
          {/* Left: Call Dispatcher */}
          <div className="space-y-4">
            <CardSpotlight className="p-5">
              <div className="flex items-center gap-2 border-b border-line pb-3 mb-4">
                <PhoneCall className="h-4 w-4 text-fg" />
                <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                  Start a Study Call
                </h2>
              </div>

              <div>
                <label htmlFor="invitee" className="font-mono text-xs text-fg-dim block mb-1.5">
                  Friend&apos;s Username or ID
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="invitee"
                    className="h-10 flex-1 rounded-lg border border-line bg-surface-3 px-3 font-mono text-xs text-fg transition-colors placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none"
                    placeholder="Enter friend's username…"
                    value={invitee}
                    onChange={(e) => setInvitee(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const id = invitee.trim();
                      void start(id, displayName(id, directory));
                    }}
                  />
                  <Button
                    variant="primary"
                    onClick={() => {
                      const id = invitee.trim();
                      void start(id, displayName(id, directory));
                    }}
                    disabled={!invitee.trim()}
                  >
                    Call Now →
                  </Button>
                </div>

                <div className="mt-4 space-y-2 border-t border-line pt-3 font-mono text-[11px] text-fg-dim">
                  <div className="flex items-center justify-between">
                    <span>Daily Quota:</span>
                    <span className="text-fg font-semibold">15 mins / day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Connection:</span>
                    <span className="text-fg-muted flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Private &amp; Secure
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Screen Share:</span>
                    <span className="text-fg-muted flex items-center gap-1">
                      <MonitorUp className="h-3 w-3" />
                      High Definition
                    </span>
                  </div>
                </div>
              </div>
            </CardSpotlight>

            {/* Hardware / Helpful Tips Card */}
            <Card className="p-4 bg-surface-1/40 border-line">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-fg mb-2">
                <Video className="h-3.5 w-3.5 text-fg" />
                <span>Voice &amp; Video Tips</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-fg-muted">
                Calls are private and fast. You can talk out loud and share your screen to solve tricky puzzles together.
              </p>
            </Card>
          </div>

          {/* Right: Study Partners & Call Records */}
          <div className="space-y-6">
            {/* Study Partners Roster */}
            <CardSpotlight className="p-5">
              <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-fg" />
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                    Study Group Friends
                  </h3>
                </div>
                {partnerRows.length > 0 && (
                  <span className="font-mono text-[10px] text-fg-dim">
                    {partnerRows.length} available
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {partnerRows.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Users className="h-5 w-5" />}
                    title="No study group friends found"
                    description="Join a study group to connect with friends for one-click calling."
                    action={
                      <Link href="/groups" className={buttonStyles("secondary", "sm")}>
                        Find Study Groups →
                      </Link>
                    }
                  />
                ) : (
                  partnerRows.map((partner) => {
                    const name = displayName(partner.id, directory);
                    return (
                      <div
                        key={partner.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-3/50 p-2.5 transition-colors hover:border-line-strong hover:bg-surface-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-4 text-fg font-mono text-[10px] font-semibold">
                            {name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-medium text-fg">{name}</span>
                            <span className="block truncate font-mono text-[10px] text-fg-dim">
                              via {partner.via}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void start(partner.id, name)}
                        >
                          Call Now →
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardSpotlight>

            {/* Call History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                  Call Records
                </h3>
                {(items?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => (clearArmed ? void clearHistory() : setClearArmed(true))}
                    onBlur={() => setClearArmed(false)}
                    className={cn(
                      "font-mono text-[10px] transition-colors",
                      clearArmed ? "text-fg font-bold" : "text-fg-dim hover:text-fg",
                    )}
                  >
                    {clearArmed ? "Confirm Clear →" : "Clear Records →"}
                  </button>
                )}
              </div>

              {items === null && (
                <div className="space-y-2">
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {items?.length === 0 && (
                <Card>
                  <EmptyState
                    compact
                    icon={<Phone className="h-5 w-5" />}
                    title="No past call records"
                    description="Completed and missed sessions will appear here."
                  />
                </Card>
              )}

              {items && items.length > 0 && (
                <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-2 shadow-card">
                  {items.map((call) => {
                    const isArmed = armedDelete === call.id;
                    return (
                      <div
                        key={call.id}
                        className="flex items-center justify-between gap-3 p-3 text-xs transition-colors hover:bg-surface-3/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="font-mono text-xs">
                            {call.type === "group" ? "👥" : "📞"}
                          </span>
                          <span className="font-medium capitalize text-fg">{call.type} call</span>
                          {call.status === "missed" && (
                            <Badge variant="outline" size="sm">Missed</Badge>
                          )}
                          {call.duration_sec ? (
                            <span className="font-mono text-[11px] text-fg-muted">
                              {Math.round(call.duration_sec / 60)} min
                            </span>
                          ) : null}
                          {call.screen_share_used && (
                            <span className="hidden items-center gap-1 rounded bg-surface-4 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted sm:inline-flex">
                              <MonitorUp className="h-3 w-3" />
                              Screen
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden font-mono text-[11px] text-fg-dim sm:inline">
                            {call.started_at ? new Date(call.started_at).toLocaleDateString() : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => (isArmed ? void deleteCall(call.id) : setArmedDelete(call.id))}
                            onBlur={() => setArmedDelete(null)}
                            className={cn(
                              "rounded px-2 py-0.5 font-mono text-[10px] transition-all",
                              isArmed
                                ? "animate-shake-x bg-brand text-on-brand font-semibold shadow-xs"
                                : "border border-line bg-surface-3 text-fg-muted hover:border-line-strong hover:text-fg",
                            )}
                          >
                            {isArmed ? "Confirm →" : "Delete →"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
