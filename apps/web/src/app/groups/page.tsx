"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { KeyRound, Plus, RefreshCw, Users } from "lucide-react";
import { ApiError, apiFetch, type GroupDTO } from "@/lib/api";
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
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

interface FieldErrors {
  name?: string;
  code?: string;
}

/** Animated inline error: slides down + fades in, then shakes its field. */
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
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
      const created = await apiFetch<GroupDTO>("/groups", {
        method: "POST",
        token,
        body: { name: trimmed },
      });
      setName("");
      await load();
      // Highlight the freshly created card so it reads as "added", not "was
      // always there" — the list itself sorts by recency on the server.
      setCreatedId(created.id ?? null);
      setNotice(`Created ${created.name ?? trimmed}.`);
    } catch (e) {
      setErrors({
        name:
          e instanceof ApiError && e.status === 429
            ? "Free plan allows one active cohort. Upgrade for unlimited groups."
            : e instanceof Error
              ? e.message
              : "Could not create cohort.",
      });
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, code: "Enter the invite code." }));
      setShakeKey((k) => k + 1);
      return;
    }
    if (trimmed.length < 4) {
      setErrors((prev) => ({ ...prev, code: "Invite codes are at least 4 characters." }));
      setShakeKey((k) => k + 1);
      return;
    }

    setBusy("join");
    setErrors({});
    try {
      const token = await getToken();
      const joined = await apiFetch<GroupDTO>("/groups/join", {
        method: "POST",
        token,
        body: { code: trimmed },
      });
      setCode("");
      await load();
      setNotice(`Joined ${joined.name ?? "cohort"}.`);
    } catch (e) {
      setErrors({
        code:
          e instanceof ApiError && e.status === 404
            ? "No cohort matches that code."
            : e instanceof Error
              ? e.message
              : "Could not join with that code.",
      });
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
          <span>Collaborative protocols</span>
          <span className="text-fg-muted">{"//"}</span>
          <span>Study cohorts</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Study Groups</h1>
        <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
          Solve challenge questions together, discuss derivations in real time, and start a study
          call straight from the room.
        </p>
      </div>

      {notice && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between gap-3 rounded-card border border-white/40 bg-surface-2 px-3.5 py-2.5 text-xs text-white shadow-glow"
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
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-dashed border-white/30 bg-surface-2 px-3.5 py-2.5 text-xs text-fg">
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

      {/* Create / join */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" aria-hidden="true" />
              Create a cohort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div key={`name-${shakeKey}`} animate={{ x: errors.name ? [0, -4, 4, -4, 0] : 0 }} transition={{ duration: 0.2 }}>
              <label htmlFor="group-name" className="sr-only">
                New group name
              </label>
              <div className="flex gap-2">
                <input
                  id="group-name"
                  ref={nameRef}
                  aria-invalid={Boolean(errors.name)}
                  className={cn(
                    "h-10 flex-1 rounded-btn border bg-surface-3 px-3 text-sm text-fg transition-colors placeholder:text-fg-dim focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white/50 outline-none",
                    errors.name ? "border-white/50" : "border-line",
                  )}
                  placeholder="e.g. Distributed LLM reading group"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  onKeyDown={(event) => event.key === "Enter" && void create()}
                />
                <Button variant="primary" loading={busy === "create"} disabled={busy !== null} onClick={() => void create()}>
                  Create
                </Button>
              </div>
              <FieldError message={errors.name} />
            </motion.div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" aria-hidden="true" />
              Join with a code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div key={`code-${shakeKey}`} animate={{ x: errors.code ? [0, -4, 4, -4, 0] : 0 }} transition={{ duration: 0.2 }}>
              <label htmlFor="group-code" className="sr-only">
                Invite code
              </label>
              <div className="flex gap-2">
                <input
                  id="group-code"
                  aria-invalid={Boolean(errors.code)}
                  className={cn(
                    "h-10 flex-1 rounded-btn border bg-surface-3 px-3 font-mono text-sm uppercase tracking-widest text-fg transition-colors placeholder:tracking-normal placeholder:text-fg-dim focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white/50 outline-none",
                    errors.code ? "border-white/50" : "border-line",
                  )}
                  placeholder="e.g. A3F9B2"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                  onKeyDown={(event) => event.key === "Enter" && void join()}
                />
                <Button
                  variant="secondary"
                  loading={busy === "join"}
                  disabled={busy !== null}
                  onClick={() => void join()}
                >
                  Join
                </Button>
              </div>
              <FieldError message={errors.code} />
            </motion.div>
          </CardContent>
        </Card>
      </div>

      {/* Cohorts */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Your active cohorts
          </h2>
          {groups && groups.length > 0 && (
            <span className="font-mono text-[10px] text-fg-dim">
              {groups.length} cohort{groups.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-3">
          {groups === null &&
            [0, 1].map((row) => (
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
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={SPRING.pop}
                className={cn(
                  "rounded-card",
                  createdId === group.id && "ring-1 ring-white shadow-glow",
                )}
              >
                <Link
                  href={`/groups/${group.id}`}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-2 p-4 shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/50 hover:shadow-glow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg group-hover:text-white">
                        {group.name}
                      </span>
                      {group.owner_id === userId && (
                        <Badge variant="solid" size="sm">
                          Owner
                        </Badge>
                      )}
                      {inRoom > 0 && <LiveDot label={`${inRoom} in room`} />}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {group.member_count}/{group.max_members}
                      </span>
                      <span className="text-fg-dim">{group.privacy.replace("_", " ")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {members.length > 0 && (
                      <AvatarStack userIds={members} directory={directory} />
                    )}
                    <span className="font-mono text-[11px] text-fg-muted transition-colors group-hover:text-white">
                      Enter room
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}

          {groups !== null && groups.length === 0 && !loadError && (
            <Card>
              <EmptyState
                icon={<Users className="h-6 w-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />}
                title="No cohorts yet"
                description="Create a study cohort for your reading group, or join an existing one with an invite code."
                action={
                  <Button variant="primary" size="sm" onClick={() => nameRef.current?.focus()}>
                    Name your first cohort
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </section>

      <p className="mt-6 font-mono text-[10px] leading-relaxed text-fg-dim">
        Member avatars fall back to a monogram when a display name is not published on today&apos;s
        leaderboard. The live indicator counts engineers currently inside the room.
      </p>
    </main>
  );
}
