"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, FlaskConical, ShieldAlert, Wrench } from "lucide-react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Admin sub-navigation (§ admin surface).
 *
 * The four admin pages previously linked to each other through underlined words
 * buried inside a sentence ("Review queue · Reports · Platform"), which gave no
 * sense of place and was inconsistent with the sliding-pill navigation used in
 * the workbench rail and the difficulty filter. This is the same shared-layout
 * pattern, so the active marker slides rather than jumping.
 */
const ITEMS = [
  { href: "/admin", label: "Bank", icon: FlaskConical, hint: "Buffer health & top-ups" },
  { href: "/admin/review", label: "Review queue", icon: Wrench, hint: "Approve or flag generations" },
  { href: "/admin/reports", label: "Reports", icon: ShieldAlert, hint: "Reported messages & calls" },
  { href: "/admin/analytics", label: "Platform", icon: BarChart3, hint: "Usage & revenue" },
] as const;

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <div className="border-b border-line pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Admin</span>
            <span className="text-fg-dim">{"//"}</span>
            <span>Restricted surface</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <nav aria-label="Admin sections" className="mt-4">
        <ul className="flex flex-wrap items-center gap-0.5 rounded-btn border border-line bg-surface-2 p-0.5">
          {ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.hint}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
                    active ? "text-brand-ink" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-tab-active"
                      transition={reduced ? { duration: 0 } : SPRING.snappy}
                      className="absolute inset-0 rounded-[6px] bg-brand-soft shadow-card"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn("relative z-10 h-3.5 w-3.5", active ? "text-brand-ink" : "text-fg-muted")}
                    aria-hidden="true"
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Shared page frame so all four admin routes line up on the same grid. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
  );
}
