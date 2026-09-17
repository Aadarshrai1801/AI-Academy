"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ai-academy:theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ai-academy:theme-change", callback);
  };
}

function getSnapshot(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("ai-academy:theme") as "dark" | "light") || "light";
}

function getServerSnapshot(): "dark" | "light" {
  return "light";
}

/**
 * ThemeToggle — Invertible Themed Switcher (§1.1).
 *
 * Inverts cleanly between the near-black slate dark canvas (#18181B) and the
 * off-white light canvas (#F8F9FA). Remembers user preference in localStorage.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const reduced = useReducedMotion();

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("ai-academy:theme", next);
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event("ai-academy:theme-change"));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-muted transition-colors hover:border-line-strong hover:bg-surface-3 hover:text-fg",
        className,
      )}
    >
      <motion.div
        key={theme}
        initial={reduced ? false : { rotate: isDark ? -45 : 45, opacity: 0, scale: 0.8 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={SPRING.snappy}
        className="flex items-center justify-center"
      >
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </motion.div>
    </button>
  );
}
