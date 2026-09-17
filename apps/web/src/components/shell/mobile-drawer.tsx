"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { X } from "lucide-react";
import { NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";
import { UserMenu } from "@/components/shell/user-menu";
import { LogoMark } from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { TelemetryState } from "@/lib/telemetry";

/**
 * Mobile navigation (§2.8).
 *
 * A slide-out drawer rather than a bottom tab bar: the workbench has six
 * destinations plus live telemetry and an account menu, which cannot fit a
 * 375px tab bar without either dropping labels or inventing short names that
 * differ from desktop. The drawer keeps full parity with the rail — same
 * labels, same order, same telemetry — so nothing is desktop-only.
 *
 * Behaviour: closes on route change, Escape, or backdrop click; locks body
 * scroll while open; moves focus into the panel so keyboard users are not left
 * behind on the page underneath.
 */
export function MobileDrawer({
  open,
  onClose,
  telemetry,
}: {
  open: boolean;
  onClose: () => void;
  telemetry: TelemetryState;
}) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Route change closes the drawer (a link inside may not unmount it).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Scroll lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape to close + focus the panel on open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const { summary, quota } = telemetry;
  const currentStreak = summary?.streak.current ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <motion.div
            className="absolute inset-0 bg-[#18181B]/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Workbench navigation"
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { x: "-100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "-100%" }}
            transition={reduced ? { duration: 0 } : SPRING.soft}
            className="relative flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface-1 shadow-glow outline-none"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <div className="flex items-center gap-2.5">
                <LogoMark size={28} className="shadow-xs" />
                <span className="text-sm font-bold tracking-tight text-fg">AI Academy</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label="Workbench" className="flex-1 overflow-y-auto px-2.5 py-4">
              <p className="px-2.5 pb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
                Workbench
              </p>
              <ul className="flex flex-col gap-0.5">
                {NAV_ITEMS.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-colors",
                          active
                            ? "border border-brand/20 bg-brand-soft font-medium text-brand-ink shadow-glow"
                            : "border border-transparent text-fg-muted hover:bg-surface-3/60 hover:text-fg",
                        )}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", active ? "text-brand-ink" : "text-fg-dim")}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="shrink-0 border-t border-line px-2.5 py-3">
              {isSignedIn ? (
                <>
                  <div className="flex items-center justify-between rounded-card border border-line bg-surface-2 px-3 py-2.5 text-[11px]">
                    <span className="text-fg-muted">Streak</span>
                    <span className="font-mono font-medium tabular-nums text-fg">{currentStreak}d</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between rounded-card border border-line bg-surface-2 px-3 py-2.5 text-[11px]">
                    <span className="text-fg-muted">Questions left</span>
                    <span className="font-mono font-medium tabular-nums text-fg">
                      {quota ? (quota.limit === -1 ? "∞" : `${quota.remaining}/${quota.limit}`) : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <Link
                  href="/sign-in"
                  className="block rounded-btn border border-line-strong bg-surface-3 px-3 py-2 text-center font-mono text-[11px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-4 hover:shadow-glow"
                >
                  Sign in to track progress
                </Link>
              )}
            </div>

            <div className="shrink-0 border-t border-line p-2.5">
              <UserMenu variant="rail" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
