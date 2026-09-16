"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type QuotaState, type SummaryDTO } from "@/lib/api";

/**
 * Shell telemetry (streak / points / rank / quota), provided once per session.
 *
 * This started as a plain hook, but the Practice page needs the same numbers
 * for its session progress bar — and two independent hook instances meant two
 * identical requests per navigation. It is now a context so every consumer
 * reads one shared payload.
 *
 * Refreshes when:
 * - the user signs in,
 * - the route changes (practice → leaderboard should show the new score),
 * - any surface dispatches `TELEMETRY_REFRESH_EVENT` — e.g. Practice after
 *   grading an attempt, which is what makes the streak badge pulse.
 *
 * The payload is stored with the `userId` it belongs to and masked when that no
 * longer matches, so sign-out/sign-in cannot briefly render the previous
 * account's streak. There is deliberately no `setLoading` before the request:
 * previous values stay on screen during a route-change refresh (no shell
 * flicker), and "loading" simply means "nothing for this user yet".
 */
export interface TelemetryState {
  summary: SummaryDTO | null;
  quota: QuotaState | null;
  loading: boolean;
  refresh: () => void;
}

export const TELEMETRY_REFRESH_EVENT = "ai-academy:telemetry-refresh";

/** Call after any action that changes score, streak, or quota. */
export function requestTelemetryRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TELEMETRY_REFRESH_EVENT));
  }
}

interface TelemetryPayload {
  userId: string;
  summary: SummaryDTO | null;
  quota: QuotaState | null;
}

const TelemetryContext = createContext<TelemetryState | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const pathname = usePathname();

  const [payload, setPayload] = useState<TelemetryPayload | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const [summary, quota] = await Promise.all([
          apiFetch<SummaryDTO>("/attempts/me/summary", { token }).catch(() => null),
          apiFetch<QuotaState>("/quota/check?feature=practice_questions", { token }).catch(() => null),
        ]);
        if (cancelled) return;
        setPayload({ userId, summary, quota });
      } catch {
        /* quiet fail: the shell must never block on telemetry */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, pathname, nonce]);

  useEffect(() => {
    window.addEventListener(TELEMETRY_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(TELEMETRY_REFRESH_EVENT, refresh);
  }, [refresh]);

  const value = useMemo<TelemetryState>(() => {
    const current = payload && payload.userId === userId ? payload : null;
    return {
      summary: current?.summary ?? null,
      quota: current?.quota ?? null,
      loading: Boolean(isSignedIn) && current === null,
      refresh,
    };
  }, [payload, userId, isSignedIn, refresh]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(): TelemetryState {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error("useTelemetry() must be used inside <TelemetryProvider>");
  return ctx;
}
