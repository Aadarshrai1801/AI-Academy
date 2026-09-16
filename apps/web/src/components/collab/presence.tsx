"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type BoardEntry } from "@/lib/api";
import { SPRING } from "@/lib/motion";

/**
 * user_id → username, assembled from the public leaderboard.
 *
 * There is no users-directory endpoint and §0 forbids inventing API contracts,
 * so this reads the one existing payload that maps ids to display names.
 * Coverage is therefore partial — it only knows about engineers who have
 * scored today — and callers must render an honest fallback rather than
 * pretending every member is named.
 */
export function useUserDirectory(): Record<string, string> {
  const { getToken, isSignedIn } = useAuth();
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    void getToken()
      .then((token) => apiFetch<{ entries: BoardEntry[] }>("/leaderboard/top?limit=100", { token }))
      .then((result) => {
        if (!live) return;
        const next: Record<string, string> = {};
        for (const entry of result.entries) next[entry.userId] = entry.username;
        setMap(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isSignedIn, getToken]);

  return map;
}

/** Display name with a stable, non-embarrassing fallback. */
export function displayName(userId: string, directory: Record<string, string>): string {
  const known = directory[userId];
  if (known) return known;
  // Clerk ids are prefixed (`user_…`); the tail is the only distinctive part.
  const tail = userId.replace(/^user_/, "").slice(-4).toUpperCase();
  return `Engineer ${tail}`;
}

/** Deterministic hue per user so avatars are stable across renders and pages. */
export function avatarHue(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 360;
  }
  return hash;
}

export interface AvatarStackProps {
  userIds: string[];
  directory: Record<string, string>;
  max?: number;
  size?: "sm" | "md";
}

/**
 * Overlapping member avatars (§2.5) with a hover fan-out.
 *
 * Avatars are monogram circles tinted by a deterministic hue — no avatar
 * upload endpoint exists — and the fan-out is a CSS transform on hover, so it
 * costs nothing on touch devices where hover never fires.
 */
export function AvatarStack({ userIds, directory, max = 5, size = "sm" }: AvatarStackProps) {
  const shown = userIds.slice(0, max);
  const overflow = userIds.length - shown.length;
  const dimension = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <motion.div className="flex items-center" initial="rest" whileHover="fan" animate="rest">
      {shown.map((userId, index) => {
        const hue = avatarHue(userId);
        const name = displayName(userId, directory);
        // Fan out symmetrically around the stack's centre.
        const offset = (index - (shown.length - 1) / 2) * 5;
        return (
          <motion.span
            key={userId}
            title={name}
            variants={{ rest: { x: 0 }, fan: { x: offset } }}
            transition={SPRING.snappy}
            style={{
              backgroundColor: `hsl(${hue} 72% 93%)`,
              borderColor: `hsl(${hue} 55% 74%)`,
              color: `hsl(${hue} 55% 28%)`,
              zIndex: shown.length - index,
            }}
            className={`relative grid shrink-0 place-items-center rounded-full border font-mono font-semibold ring-2 ring-surface-2 ${dimension}`}
          >
            {name.slice(0, 2).toUpperCase()}
          </motion.span>
        );
      })}

      {overflow > 0 && (
        <motion.span
          variants={{ rest: { x: 0 }, fan: { x: 5 } }}
          transition={SPRING.snappy}
          className={`relative grid shrink-0 place-items-center rounded-full border border-line-strong bg-surface-4 font-mono font-semibold text-fg-muted ring-2 ring-surface-2 ${dimension}`}
          title={`${overflow} more member${overflow === 1 ? "" : "s"}`}
        >
          +{overflow}
        </motion.span>
      )}
    </motion.div>
  );
}

/** Expanding "someone is in the room" indicator. */
export function LiveDot({ label, tone = "success" }: { label: string; tone?: "success" | "brand" }) {
  const color = tone === "success" ? "bg-success" : "bg-brand";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-fg-muted">
      <span className="relative grid h-2 w-2 place-items-center" aria-hidden="true">
        <span className={`absolute h-2 w-2 rounded-full ${color}`} />
        <span className={`absolute h-2 w-2 animate-pulse-ring rounded-full ${color}`} />
      </span>
      {label}
    </span>
  );
}

type RealtimeMode = { mode: "ably"; tokenRequest: unknown } | { mode: "polling"; intervalMs: number };

/**
 * Live room occupancy per group (§2.5).
 *
 * Subscribes to Ably presence on each `group:<id>` channel using the existing
 * `/realtime/token` capability — no new endpoint. It deliberately does **not**
 * call `presence.enter()`: the count means "people currently inside the study
 * room", not "people who happen to have the list open", which is the honest
 * reading of a presence affordance and keeps the number actionable.
 *
 * Best effort throughout: if realtime is in polling mode or Ably fails, the
 * map stays empty and no dots render.
 */
export function useGroupPresence(groupIds: string[]): Record<string, number> {
  const { getToken } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = groupIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",").filter(Boolean) : [];
    if (ids.length === 0) return;

    let cancelled = false;
    let close: (() => void) | null = null;

    void (async () => {
      try {
        const token = await getToken();
        const mode = await apiFetch<RealtimeMode>("/realtime/token", { method: "POST", token });
        if (mode.mode !== "ably" || cancelled) return;

        const Ably = await import("ably");
        const client = new Ably.Realtime({
          authCallback: (_params, callback) => {
            getToken()
              .then((fresh) => apiFetch<RealtimeMode>("/realtime/token", { method: "POST", token: fresh }))
              .then((next) =>
                callback(null, next.mode === "ably" ? (next.tokenRequest as import("ably").TokenRequest) : null),
              )
              .catch((e: unknown) =>
                callback(e instanceof Error ? e.message : "realtime auth failed", null),
              );
          },
        });

        const channels = ids.map((id) => client.channels.get(`group:${id}`));
        await Promise.all(channels.map((channel) => channel.attach()));
        if (cancelled) {
          void client.close();
          return;
        }

        for (const channel of channels) {
          const groupId = channel.name.replace(/^group:/, "");
          const sync = async () => {
            try {
              const members = await channel.presence.get();
              if (!cancelled) setCounts((prev) => ({ ...prev, [groupId]: members.length }));
            } catch {
              /* transient */
            }
          };
          void sync();
          void channel.presence.subscribe(() => void sync());
        }

        close = () => void client.close();
      } catch {
        /* presence is best-effort by design */
      }
    })();

    return () => {
      cancelled = true;
      close?.();
    };
  }, [key, getToken]);

  return counts;
}
