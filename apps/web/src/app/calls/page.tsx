"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, MonitorUp, Phone, PhoneCall, RefreshCw, Trash2, Users, X } from "lucide-react";
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

  // Lets the user back out of a call that is still being set up.
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

      // Study partners are people you already share a cohort with — derived
      // from existing group membership rather than a new endpoint.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
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
          ? "Daily call cap reached (15 min/day on Free). It resets at 00:00 UTC."
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
      setItems((prev) => (prev ?? []).filter((call) => call.id !== id));
      setArmedDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete call.");
    }
  }

  async function clearHistory() {
    try {
      const token = await getToken();
      await apiFetch("/calls/history/all", { method: "DELETE", token });
      setItems([]);
      setClearArmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear history.");
    }
  }

  const partnerRows = useMemo(() => partners.slice(0, 6), [partners]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
          <span>Collaborative protocols</span>
          <span className="text-line-strong">{"//"}</span>
          <span>Encrypted calls</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Live Calls</h1>
        <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
          Screen-share architecture sessions and review derivations with a study partner.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-white/20 bg-white/[0.04] px-3.5 py-2.5 text-xs text-fg">
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

      {/* Live sessions */}
      <AnimatePresence>
        {active.length > 0 && (
          <motion.section
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            className="mt-6"
          >
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
              In progress
            </h2>
            <div className="mt-2 grid gap-2">
              {active.map((call) => (
                <Link
                  key={call.id}
                  href={`/calls/${call.id}`}
                  className="flex items-center justify-between rounded-card border border-white/25 bg-white/[0.04] p-3.5 transition-all hover:border-white/50 hover:bg-white/[0.07] backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.03)]"
                >
                  <span className="flex items-center gap-3">
                    <LiveDot label="" />
                    <span className="text-sm font-medium text-fg">
                      {call.type === "group" ? "Group study session" : "1:1 technical call"}
                    </span>
                    <span className="font-mono text-[11px] text-fg-muted">
                      {call.participant_ids.length} in room
                    </span>
                  </span>
                  <span className="rounded-md border border-white bg-white px-3 py-1 font-mono text-[11px] font-semibold text-black transition-all hover:bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                    Rejoin
                  </span>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Connecting state: replaces the form while the room is established. */}
      <AnimatePresence mode="wait" initial={false}>
        {connecting ? (
          <motion.div
            key="connecting"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            className="mt-6"
          >
            <CardSpotlight className="border-white/20">
              <div className="flex flex-col items-center gap-4 py-8">
                {/* Pulsing rings around the partner avatar, like a real dialler. */}
                <span className="relative grid h-20 w-20 place-items-center">
                  {!reduced &&
                    [0, 1, 2].map((ring) => (
                      <motion.span
                        key={ring}
                        className="absolute h-16 w-16 rounded-full border-2 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
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
                  <span
                    className="relative grid h-16 w-16 place-items-center rounded-full border border-white/30 bg-white/10 text-white font-mono text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                    {connecting.name.slice(0, 2).toUpperCase()}
                  </span>
                </span>

                <div className="text-center">
                  <p className="text-sm font-semibold text-fg">
                    Connecting to {connecting.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-fg-muted">
                    Establishing encrypted room and negotiating media…
                  </p>
                </div>

                <Button
                  variant="ghost"
                  leftIcon={<X className="h-3.5 w-3.5" />}
                  onClick={() => {
                    cancelled.current = true;
                    setConnecting(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardSpotlight>
          </motion.div>
        ) : (
          /* Start call + study partners */
          <motion.div
            key="idle"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            className="mt-6 grid gap-4 lg:grid-cols-2"
          >
            <CardSpotlight>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PhoneCall className="h-4 w-4 text-white" aria-hidden="true" />
                  <h3 className="font-semibold text-sm text-fg">Start a 1:1 call</h3>
                </div>
                <div>
                  <label htmlFor="invitee" className="sr-only">
                    Partner user ID
                  </label>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      id="invitee"
                      className="h-10 flex-1 rounded-btn border border-line bg-surface-3 px-3 font-mono text-xs text-fg transition-colors placeholder:text-fg-dim focus-visible:border-white/60 focus-visible:outline-none"
                      placeholder="Partner user ID…"
                      value={invitee}
                      onChange={(event) => setInvitee(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        const id = invitee.trim();
                        void start(id, displayName(id, directory));
                      }}
                    />
                    <Button
                      onClick={() => {
                        const id = invitee.trim();
                        void start(id, displayName(id, directory));
                      }}
                      disabled={!invitee.trim()}
                      leftIcon={<Phone className="h-3.5 w-3.5" />}
                    >
                      Start call
                    </Button>
                  </div>
                  <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-fg-dim">
                    Free tier includes 15 call minutes per day. Room is end-to-end encrypted and the
                    timer stops automatically at the cap.
                  </p>
                </div>
              </div>
            </CardSpotlight>

            <CardSpotlight>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-white" aria-hidden="true" />
                    <h3 className="font-semibold text-sm text-fg">Study partners</h3>
                  </div>
                  {partnerRows.length > 0 && (
                    <span className="font-mono text-[10px] text-fg-dim">
                      from your cohorts
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {partnerRows.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Users className="h-5 w-5" />}
                      title="No partners yet"
                      description="Join a study cohort and your cohort mates appear here for one-click calls."
                      action={
                        <Link href="/groups" className={buttonStyles("secondary", "sm")}>
                          Browse cohorts
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
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/[0.08] text-white font-mono text-[10px] font-semibold"
                              aria-hidden="true"
                            >
                              {name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-fg">{name}</span>
                              <span className="block truncate font-mono text-[10px] text-fg-dim">
                                via {partner.via}
                              </span>
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Phone className="h-3 w-3" />}
                            onClick={() => void start(partner.id, name)}
                          >
                            Call
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardSpotlight>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Recent calls
          </h2>
          {(items?.length ?? 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (clearArmed ? void clearHistory() : setClearArmed(true))}
              onBlur={() => setClearArmed(false)}
              className={cn(clearArmed && "text-white font-bold")}
              leftIcon={clearArmed ? <Check className="h-3 w-3" /> : undefined}
            >
              {clearArmed ? "Confirm clear" : "Clear history"}
            </Button>
          )}
        </div>

        <div className="mt-3">
          {items === null && (
            <div className="flex flex-col">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {items?.length === 0 && (
            <Card>
              <EmptyState
                compact
                icon={<Phone className="h-5 w-5" />}
                title="No calls yet"
                description="Completed and missed calls are listed here with their duration."
                action={
                  <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load()}>
                    Refresh
                  </Button>
                }
              />
            </Card>
          )}

          {items && items.length > 0 && (
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-2">
              {items.map((call) => {
                const isArmed = armedDelete === call.id;
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between gap-3 p-3.5 text-xs transition-colors hover:bg-surface-3/60"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="font-mono text-[11px] text-fg-dim" aria-hidden="true">
                        {call.type === "group" ? "👥" : "📞"}
                      </span>
                      <span className="font-medium capitalize text-fg">{call.type} session</span>
                      {call.status === "missed" && (
                        <Badge variant="outline" size="sm">
                          Missed
                        </Badge>
                      )}
                      {call.status === "failed" && (
                        <Badge variant="outline" size="sm">
                          Failed
                        </Badge>
                      )}
                      {call.duration_sec ? (
                        <span className="font-mono text-[11px] text-fg-muted">
                          {Math.round(call.duration_sec / 60)} min
                        </span>
                      ) : null}
                      {call.screen_share_used && (
                        <span className="hidden items-center gap-1 rounded-md bg-surface-4 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted sm:inline-flex">
                          <MonitorUp className="h-3 w-3" aria-hidden="true" />
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
                        aria-label={isArmed ? "Confirm delete call" : "Delete call from history"}
                        title={isArmed ? "Confirm delete" : "Delete from history"}
                        onClick={() => (isArmed ? void deleteCall(call.id) : setArmedDelete(call.id))}
                        onBlur={() => setArmedDelete(null)}
                        className={cn(
                          "rounded-md p-1.5 font-mono transition-all",
                          isArmed
                            ? "animate-shake-x bg-white text-black border border-white font-semibold"
                            : "text-fg-dim hover:bg-white/10 hover:text-white",
                        )}
                      >
                        {isArmed ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <p className="mt-6 font-mono text-[10px] leading-relaxed text-fg-dim">
        Partner names come from today&apos;s leaderboard where available, because the API exposes no
        standalone user directory.
      </p>
    </main>
  );
}
