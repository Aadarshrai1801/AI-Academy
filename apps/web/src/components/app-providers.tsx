"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui";
import { TelemetryProvider } from "@/lib/telemetry";

/**
 * Client-side providers for the whole app.
 *
 * `MotionConfig reducedMotion="user"` makes Framer Motion itself honour
 * `prefers-reduced-motion` (transform animations are dropped, opacity-only
 * remains) — the framework half of §1.2. Components additionally branch on
 * `useReducedMotion()` where the fallback needs a different shape entirely.
 *
 * `TelemetryProvider` owns the single streak/quota fetch shared by the shell
 * and any page that needs session progress. `ToastProvider` owns the
 * notification viewport so any page can raise a toast via `useToast()`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TelemetryProvider>
        <ToastProvider>{children}</ToastProvider>
      </TelemetryProvider>
    </MotionConfig>
  );
}
