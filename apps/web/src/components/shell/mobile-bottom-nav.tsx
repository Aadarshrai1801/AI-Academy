"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Crosshair,
  LayoutDashboard,
  MessageSquareCode,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

const TABS = [
  { href: "/practice", label: "Practice", icon: Crosshair },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/ask", label: "Tutor", icon: MessageSquareCode },
  { href: "/groups", label: "Groups", icon: Users },
] as const;

/**
 * MobileBottomNav — Aceternity-style floating bottom dock (§2.8).
 *
 * Appears below ~768px (`md:hidden`) so mobile users can navigate between
 * the core daily-practice surfaces using comfortable thumb reaches.
 * Floating glassmorphism with sliding active indicator pill.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  // Hide on landing or auth flows
  if (pathname === "/" || pathname.startsWith("/sign-")) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-40 mx-auto flex max-w-sm justify-center px-3 md:hidden"
    >
      <div className="pointer-events-auto flex w-full items-center justify-between rounded-full border border-line-strong bg-surface-1/90 p-1.5 backdrop-blur-xl shadow-lift">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-fg font-semibold" : "text-fg-dim hover:text-fg-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-bottom-tab-active"
                  transition={reduced ? { duration: 0 } : SPRING.snappy}
                  className="absolute inset-0 rounded-full bg-surface-3 shadow-glow"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-4 w-4 transition-transform",
                  active && "scale-105 text-fg",
                )}
                aria-hidden="true"
              />
              <span className="relative z-10 truncate leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
