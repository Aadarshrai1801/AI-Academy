"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, KeyRound, Plus, Radio, RefreshCw, Users } from "lucide-react";
import { apiFetch, type GroupDTO } from "@/lib/api";
import {
  AvatarStack,
  LiveDot,
  useGroupPresence,
  useUserDirectory,
} from "@/components/collab/presence";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

interface FieldErrors {
  name?: string;
  code?: string;
}

function FieldError({ message }: { message?: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          className="mt-1.5 font-mono text-[11px] font-medium text-fg-muted"
          role="alert"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default function GroupsPage() {
  const { getToken, isLoaded, userId } = useAuth();
  const directory = useUserDirectory();
  const reduced = useReducedMotion();

  const [groups, setGroups] = useState<GroupDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const nameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const result = await apiFetch<{ items: GroupDTO[] }>("/groups", { token });
      setGroups(result.items);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? `Could not load cohorts: ${e.message}` : "Load failed.");
      setGroups([]);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    queueMicrotask(() => {
      void load();
    });
  }, [isLoaded, load]);

  const groupIds = useMemo(() => (groups ?? []).map((group) => group.id), [groups]);
  const presence = useGroupPresence(groupIds);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, name: "Give the cohort a name." }));
      setShakeKey((k) => k + 1);
      return;
    }
    if (trimmed.length < 3) {
      setErrors((prev) => ({ ...prev, name: "At least 3 characters." }));
      setShakeKey((k) => k + 1);
      return;
    }

    setBusy("create");
    setErrors({});
    try {
      const token = await getToken();
      const group = await apiFetch<GroupDTO>("/groups", {
        method: "POST",
        token,
        body: { name: trimmed },
      });
      setName("");
      setCreatedId(group.id);
      setNotice(`Cohort "${group.name}" created. Share code ${group.invite_code} to invite peers.`);
      await load();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        name: e instanceof Error ? e.message : "Could not create cohort.",
      }));
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, code: "Enter an invite code." }));
      setShakeKey((k) => k + 1);
      return;
    }

    setBusy("join");
    setErrors({});
    try {
      const token = await getToken();
      const group = await apiFetch<GroupDTO>("/groups/join", {
        method: "POST",
        token,
        body: { code: trimmed },
      });
      setCode("");
      setNotice(`Joined "${group.name}".`);
      await load();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        code: e instanceof Error ? e.message : "Could not join cohort.",
      }));
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Collaborative Workspaces</span>
            <span className="text-fg-muted">{"//"}</span>
            <span>Study Cohorts</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Study Groups</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            Peer cohorts for solving daily questions together, dissecting derivations, and holding live voice syncs.
          </p>
        </div>

        {groups && (
          <Badge variant="outline">
            {groups.length} active cohort{groups.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {notice && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line-strong bg-surface-2 px-3.5 py-2.5 text-xs text-fg shadow-card"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-mono text-[10px] text-fg-muted hover:text-fg"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {loadError && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-dashed border-line-strong bg-surface-2 px-3.5 py-2.5 text-xs text-fg">
          <span>{loadError}</span>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Asymmetric Split: Cohort Dispatcher (5 cols) + Cohorts Stream (7 cols) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Dispatcher & Controls (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            {/* Tab switcher */}
            <div className="flex items-center rounded-lg border border-line bg-surface-3 p-1 font-mono text-xs mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={cn(
                  "flex-1 py-1.5 rounded-md font-semibold transition-all text-center flex items-center justify-center gap-1.5",
                  activeTab === "create"
                    ? "bg-brand text-on-brand shadow-sm"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Cohort
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("join")}
                className={cn(
                  "flex-1 py-1.5 rounded-md font-semibold transition-all text-center flex items-center justify-center gap-1.5",
                  activeTab === "join"
                    ? "bg-brand text-on-brand shadow-sm"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Join via Code
              </button>
            </div>

            {/* Create tab */}
            {activeTab === "create" && (
              <motion.div
                key={`create-pane`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div>
                  <label htmlFor="group-name" className="font-mono text-xs text-fg-dim block mb-1.5">
                    Cohort Title
                  </label>
                  <motion.div
                    key={`name-${shakeKey}`}
                    animate={{ x: errors.name ? [0, -4, 4, -4, 0] : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <input
                      id="group-name"
                      ref={nameRef}
                      aria-invalid={Boolean(errors.name)}
                      className={cn(
                        "h-10 w-full rounded-lg border bg-surface-3 px-3 text-sm text-fg transition-colors placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none",
                        errors.name ? "border-error" : "border-line",
                      )}
                      placeholder="e.g. CUDA & Kernel Optimization Cohort"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && void create()}
                    />
                    <FieldError message={errors.name} />
                  </motion.div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center"
                  loading={busy === "create"}
                  disabled={busy !== null}
                  onClick={() => void create()}
                >
                  Create & Launch Cohort
                </Button>
              </motion.div>
            )}

            {/* Join tab */}
            {activeTab === "join" && (
              <motion.div
                key={`join-pane`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div>
                  <label htmlFor="group-code" className="font-mono text-xs text-fg-dim block mb-1.5">
                    6-Character Cohort Code
                  </label>
                  <motion.div
                    key={`code-${shakeKey}`}
                    animate={{ x: errors.code ? [0, -4, 4, -4, 0] : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <input
                      id="group-code"
                      aria-invalid={Boolean(errors.code)}
                      className={cn(
                        "h-10 w-full rounded-lg border bg-surface-3 px-3 font-mono text-sm uppercase tracking-widest text-fg transition-colors placeholder:tracking-normal placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none",
                        errors.code ? "border-error" : "border-line",
                      )}
                      placeholder="e.g. A3F9B2"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && void join()}
                    />
                    <FieldError message={errors.code} />
                  </motion.div>
                </div>

                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  loading={busy === "join"}
                  disabled={busy !== null}
                  onClick={() => void join()}
                >
                  Enter Cohort
                </Button>
              </motion.div>
            )}
          </Card>

          {/* Info Card */}
          <Card className="p-4 bg-surface-1/40 border-line">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-fg mb-2">
              <Radio className="h-3.5 w-3.5 text-fg" />
              <span>Realtime Synchronization</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-fg-muted">
              Cohorts synchronize question workbench states, shared derivation notes, and realtime voice call channels via Ably and WebRTC.
            </p>
          </Card>
        </div>

        {/* Right: Active Cohorts (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-fg">
              <span>Active Study Cohorts</span>
              {groups && groups.length > 0 && (
                <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[10px] text-fg-muted">
                  {groups.length}
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-fg-dim">
              Presence monitored live
            </span>
          </div>

          <div className="space-y-3">
            {groups === null &&
              [0, 1, 2].map((row) => (
                <Card key={row} className="p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-2 h-3 w-1/4" />
                </Card>
              ))}

            {groups?.map((group) => {
              const inRoom = presence[group.id] ?? 0;
              const members = (group.member_ids ?? []).filter((id) => id !== userId);
              return (
                <motion.div
                  key={group.id}
                  layout
                  initial={reduced ? false : { opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={SPRING.pop}
                  className={cn(
                    "rounded-card",
                    createdId === group.id && "ring-1 ring-brand shadow-card",
                  )}
                >
                  <Link
                    href={`/groups/${group.id}`}
                    className="group flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface-2 p-4 shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-fg group-hover:text-fg">
                          {group.name}
                        </span>
                        {group.owner_id === userId && (
                          <Badge variant="solid" size="sm">
                            Owner
                          </Badge>
                        )}
                        {inRoom > 0 && <LiveDot label={`${inRoom} in room`} />}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {group.member_count}/{group.max_members} engineers
                        </span>
                        <span>·</span>
                        <span className="text-fg-dim capitalize">{group.privacy.replace("_", " ")}</span>
                        {group.invite_code && (
                          <>
                            <span>·</span>
                            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
                              CODE: {group.invite_code}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {members.length > 0 && (
                        <AvatarStack userIds={members} directory={directory} />
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-3 px-3 py-1.5 font-mono text-xs font-semibold text-fg group-hover:border-transparent group-hover:bg-brand group-hover:text-on-brand transition-all">
                        <span>Enter</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

            {groups !== null && groups.length === 0 && !loadError && (
              <Card>
                <EmptyState
                  icon={<Users className="h-6 w-6 text-fg" />}
                  title="No cohorts active yet"
                  description="Create a private cohort for your engineering team, or join an existing reading group using an invite code."
                  action={
                    <Button variant="primary" size="sm" onClick={() => nameRef.current?.focus()}>
                      Create your first cohort
                    </Button>
                  }
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
