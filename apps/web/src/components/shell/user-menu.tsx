"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useClerk, useUser } from "@clerk/nextjs";
import { CreditCard, Database, LayoutDashboard, LogOut, Settings, Sparkles } from "lucide-react";
import { DataRightsDialog } from "@/components/data-rights";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Rail account menu (§2.8).
 *
 * Expands on click rather than on hover so it is reachable by keyboard and
 * touch. The expand animates opacity + scale + a small y-offset instead of
 * animating `height` — same perceived "unfold", but it stays on the
 * compositor and cannot jank on a slow device (§5).
 *
 * Renders inline (not portaled) because the rail has no overflow clipping;
 * dismissing on outside-click and Escape matches the streak popover.
 */
export interface UserMenuProps {
  /** `rail` renders the full name block, `compact` is icon-only (top bar), `icon` is centered icon (collapsed rail). */
  variant?: "rail" | "compact" | "icon";
  className?: string;
}

export function UserMenu({ variant = "rail", className }: UserMenuProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const [dataRightsOpen, setDataRightsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isLoaded) {
    return <div className={cn("h-9 animate-pulse rounded-lg bg-surface-3", className)} />;
  }

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className={cn(
          "flex h-9 items-center justify-center rounded-btn border border-line-strong bg-surface-3 px-3 text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-4 hover:shadow-glow",
          variant === "icon" && "px-0 w-9",
          className,
        )}
        title="Sign in"
      >
        {variant === "icon" ? "//" : "Sign in"}
      </Link>
    );
  }

  const displayName =
    user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "Engineer";
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  const items = [
    { label: "Open profile", icon: Settings, onSelect: () => openUserProfile() },
    // Dashboard lives here (not on the workbench rail) — keep it high in the
    // profile menu so it stays easy to find.
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Billing & plans", icon: CreditCard, href: "/pricing" },
    { label: "Data & privacy", icon: Database, onSelect: () => setDataRightsOpen(true) },
  ];

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={displayName}
        title={displayName}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        transition={SPRING.snappy}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-line hover:bg-surface-3",
          variant === "icon" && "justify-center px-0",
          open && "border-line bg-surface-3 shadow-glow",
        )}
      >
        {user.imageUrl ? (
          // Clerk serves avatars from its own CDN; a plain image element keeps
          // every Clerk tenant from needing an Image-domain allow-list entry.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={displayName}
            className="h-7 w-7 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface-4 font-mono text-[11px] font-semibold text-fg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
        )}
        {variant === "rail" && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-fg">{displayName}</span>
            <span className="block truncate font-mono text-[10px] text-fg-dim">
              {email || "Signed in"}
            </span>
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={SPRING.pop}
            className={cn(
              "absolute bottom-full z-50 mb-1 w-56 origin-bottom overflow-hidden rounded-card border border-line-strong bg-surface-3 p-1 shadow-glow",
              variant === "icon" ? "left-0" : "left-0",
            )}
          >
            <div className="border-b border-line px-2.5 py-2">
              <p className="truncate text-xs font-medium text-fg">{displayName}</p>
              {email && <p className="truncate font-mono text-[10px] text-fg-dim">{email}</p>}
            </div>

            <div className="py-1">
              {items.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-fg-muted transition-colors hover:bg-surface-4 hover:text-fg"
                  >
                    <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-surface-4 hover:text-fg"
                  >
                    <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </button>
                ),
              )}
            </div>

            <div className="border-t border-line pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut({ redirectUrl: "/" });
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-surface-4 hover:text-fg"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-2">
              <Sparkles className="h-3 w-3 text-fg-muted" aria-hidden="true" />
              <span className="font-mono text-[10px] text-fg-dim">AI Academy v1.0</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DataRightsDialog open={dataRightsOpen} onClose={() => setDataRightsOpen(false)} />
    </div>
  );
}
