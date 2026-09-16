"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { apiFetch, type SummaryDTO } from "@/lib/api";
import { requestTelemetryRefresh } from "@/lib/telemetry";

/**
 * One-way display-name bootstrap, mounted once in the app shell.
 *
 * Fills `users.username` the first time a signed-in session notices it is
 * missing — this is what replaces `user_XXXX` fallbacks on the leaderboard
 * with a real name. Rules, deliberately conservative:
 *
 * - Prefer the Clerk username; fall back to a sanitized email local-part.
 * - Only fires when the stored name is missing — never overwrites, so an
 *   explicit `PATCH /users/me` (or a future settings UI) always wins.
 * - Once per session. Silent on every failure path (409 taken, 4xx, network):
 *   a display name must never block or break a session.
 */
function candidateName(
  clerkUsername: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const direct = clerkUsername?.trim();
  if (direct) return direct;
  const local = email?.split("@")[0] ?? "";
  const sanitized = local.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 30);
  return sanitized.length >= 3 ? sanitized : null;
}

export function DisplayNameSync({ summary }: { summary: SummaryDTO | null }) {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || summary === null || summary.username || attempted.current) return;
    const name = candidateName(user.username, user.primaryEmailAddress?.emailAddress);
    if (!name) return;
    attempted.current = true;
    void getToken()
      .then((token) =>
        apiFetch("/users/me", {
          method: "PATCH",
          token,
          body: {
            username: name,
            email: user.primaryEmailAddress?.emailAddress,
          },
        }),
      )
      .then(() => requestTelemetryRefresh())
      .catch(() => undefined);
  }, [isSignedIn, user, getToken, summary]);

  return null;
}
