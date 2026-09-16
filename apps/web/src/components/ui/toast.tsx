"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleCheck, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

/**
 * `<Toast>` — spring-in notifications with auto-dismiss (§3).
 *
 * Used for the Practice "streak/points" pill (§2.2), billing confirmations,
 * and destructive-action receipts. Stackable, dismissible, and dismiss
 * timers are keyed to each toast's own id so re-renders never extend a life.
 *
 * Accessibility: the viewport is a polite live region; each toast is
 * dismissible with a real button and does not steal focus.
 */
export type ToastVariant = "info" | "success" | "error" | "warning" | "brand";

export interface ToastOptions {
  title: string;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Milliseconds on screen. Pass `Infinity` for a sticky toast. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastOptions, "description">> {
  id: string;
  description?: ReactNode;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_META: Record<ToastVariant, { icon: typeof Info; className: string; bar: string }> = {
  info: { icon: Info, className: "text-info", bar: "bg-info" },
  success: { icon: CircleCheck, className: "text-success", bar: "bg-success" },
  error: { icon: XCircle, className: "text-error", bar: "bg-error" },
  warning: { icon: TriangleAlert, className: "text-warning", bar: "bg-warning" },
  brand: { icon: Info, className: "text-brand", bar: "bg-brand" },
};

const DEFAULT_DURATION = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}-${Date.now().toString(36)}`;
    setToasts((prev) => [
      ...prev,
      {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "brand",
        duration: options.duration ?? DEFAULT_DURATION,
      },
    ]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): (options: ToastOptions) => string {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider>");
  return ctx.toast;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  useEffect(() => {
    if (!Number.isFinite(toast.duration)) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const barDuration = Number.isFinite(toast.duration) ? toast.duration / 1000 : 0;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      transition={SPRING.pop}
      className="pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface-3 shadow-pop"
    >
      <div className="flex items-start gap-3 p-3.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-m-1 rounded-md p-1 text-fg-dim transition-colors hover:bg-surface-4 hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {Number.isFinite(toast.duration) && (
        <motion.span
          aria-hidden="true"
          className={cn("absolute bottom-0 left-0 h-0.5 w-full origin-left", meta.bar)}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: barDuration, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}
