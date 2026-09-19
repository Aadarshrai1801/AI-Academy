"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, Radio, Trophy, Users } from "lucide-react";
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
          <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">Study groups</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            Learn together — pick a competitive group with daily rankings, or a study group where
            rankings are off and missed questions get discussed.
          </p>
        </div>

        {groups && (
          <Badge variant="outline">
            {groups.length} active group{groups.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {notice && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line-strong bg-surface-2 px-3.5 py-2.5 text-xs text-fg"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] text-fg-muted hover:text-fg"
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
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Symmetrical Split: Group Creator / Joiner + Active Groups Stream */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
        {/* Left: Dispatcher & Controls */}
        <div className="space-y-4">
          <Card className="p-5">
            {/* Tab switcher */}
            <div className="mb-4 flex items-center rounded-btn border border-line bg-surface-3 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-btn py-1.5 text-center font-semibold transition-colors",
                  activeTab === "create"
                    ? "bg-brand text-on-brand"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("join")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-btn py-1.5 text-center font-semibold transition-colors",
                  activeTab === "join"
                    ? "bg-brand text-on-brand"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                Join with code
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
                  <label htmlFor="group-name" className="mb-1.5 block text-xs text-fg-dim">
                    Group name
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
                        "h-10 w-full rounded-btn border bg-surface-3 px-3 text-sm text-fg transition-colors placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none",
                        errors.name ? "border-error" : "border-line",
                      )}
                      placeholder="e.g. Science Explorers or Math Wizards"
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
                  Create group
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
                  <label htmlFor="group-code" className="mb-1.5 block text-xs text-fg-dim">
                    Group code (6 characters)
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
                        "h-10 w-full rounded-btn border bg-surface-3 px-3 font-mono text-sm uppercase tracking-widest text-fg transition-colors placeholder:tracking-normal placeholder:font-sans placeholder:text-fg-dim focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30 outline-none",
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
                  Join group
                </Button>
              </motion.div>
            )}
          </Card>

          {/* Info Card — one sentence on what the room is for. */}
          <Card className="border-line bg-surface-1/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <Radio className="h-3.5 w-3.5 text-fg-dim" />
              <span>Learn together in real time</span>
            </div>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              Compare answers in chat, discuss what tripped you up, and keep each other practicing.
            </p>
          </Card>
        </div>

        {/* Right: Active Groups */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Your study groups</span>
              {groups && groups.length > 0 && (
                <span className="rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[11px] text-fg-muted">
                  {groups.length}
                </span>
              )}
            </div>
            <span className="text-[11px] text-fg-dim">Live presence</span>
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
                <div
                  key={group.id}
                  className={cn("rounded-card", createdId === group.id && "ring-1 ring-brand")}
                >
                  <Link
                    href={`/groups/${group.id}`}
                    className="surface-card group flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:border-line-strong hover:bg-surface-3/40"
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

                      {/* Mode is a first-glance decision: competitive vs study
                          changes what the room is for, so it reads here in the
                          list — not only after entering. Neither mode borrows
                          the reserved outcome colors (mode is not an outcome). */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                          {group.mode === "study" ? (
                            <BookOpen className="h-3 w-3 text-fg-dim" aria-hidden="true" />
                          ) : (
                            <Trophy className="h-3 w-3 text-fg-dim" aria-hidden="true" />
                          )}
                          {group.mode === "study"
                            ? "Study — rankings off, missed questions shared"
                            : "Competitive — daily rankings"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {group.member_count}/{group.max_members} students
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{group.privacy.replace("_", " ")}</span>
                        {group.invite_code && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
                              invite {group.invite_code}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {members.length > 0 && (
                        <AvatarStack userIds={members} directory={directory} />
                      )}
                      <span className="inline-flex items-center justify-center rounded-btn border border-line bg-surface-3 px-3 py-1.5 text-xs font-semibold text-fg transition-colors group-hover:border-fg group-hover:bg-brand group-hover:text-on-brand">
                        Open
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}

            {groups !== null && groups.length === 0 && !loadError && (
              <Card>
                <EmptyState
                  icon={<Users className="h-6 w-6 text-fg" />}
                  title="No study groups active yet"
                  description="Create a group for your friends or classmates, or enter an invite code to join one."
                  action={
                    <Button variant="primary" size="sm" onClick={() => nameRef.current?.focus()}>
                      Create First Group
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
