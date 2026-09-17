"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Database, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { SPRING } from "@/lib/motion";

/**
 * GDPR/CCPA self-service controls (PRIVACY.md §7): download all stored data
 * (`GET /users/me/export`) and erase the account (`DELETE /users/me`).
 * The erase flow requires typing DELETE so it cannot happen by accident.
 *
 * Rendered as a modal from the account menu (`UserMenu` → "Data & privacy"),
 * not as a page section.
 */
export function DataRightsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [erased, setErased] = useState(false);
  const [showErase, setShowErase] = useState(false);

  // Fresh state on every close so a previous error/confirmation never lingers.
  const handleClose = useCallback(() => {
    setError(null);
    setConfirmText("");
    setShowErase(false);
    setErased(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  async function exportData() {
    setBusy("export");
    setError(null);
    try {
      const data = await apiFetch<Record<string, unknown>>("/users/me/export", {
        token: await getToken(),
        timeoutMs: 60_000,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-academy-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function eraseAccount() {
    if (confirmText !== "DELETE") return;
    setBusy("delete");
    setError(null);
    try {
      await apiFetch("/users/me?confirm=DELETE", { method: "DELETE", token: await getToken() });
      setErased(true);
      await signOut({ redirectUrl: "/" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Account deletion failed. Please contact support.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#18181B]/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-rights-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={SPRING.pop}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-modal border border-line-strong bg-surface-1 p-6 shadow-glow"
          >
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft">
                  <Database className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="data-rights-title" className="text-sm font-bold text-fg">
                    Data &amp; privacy
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-fg-dim">Your rights — export or erase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close data and privacy"
                className="rounded p-1 text-fg-dim transition-colors hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-fg-muted">
              Download everything we store about you, or permanently erase your account and data.
              See the{" "}
              <Link href="/privacy" className="text-brand-ink underline-offset-4 hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-brand-ink underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              .
            </p>

            {error && (
              <p role="alert" className="mt-3 font-mono text-xs text-state-negative-ink border border-error/40 bg-state-negative-soft p-2.5 rounded-md">
                {error}
              </p>
            )}

            {erased ? (
              <p role="status" className="mt-4 font-mono text-xs text-fg font-medium border border-line-strong bg-surface-3 p-2.5 rounded-md">
                Account erased. You have been signed out.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => void exportData()}
                  disabled={busy !== null}
                  className="rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs text-fg hover:border-line-strong hover:bg-surface-4 transition-colors disabled:opacity-50"
                >
                  {busy === "export" ? "Preparing export…" : "Download my data"}
                </button>
                {!showErase ? (
                  <button
                    type="button"
                    onClick={() => setShowErase(true)}
                    disabled={busy !== null}
                    className="rounded-btn border border-dashed border-error/50 px-4 py-2 font-mono text-xs text-state-negative-ink hover:border-error transition-colors disabled:opacity-50"
                  >
                    Delete my account
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="erase-confirm" className="sr-only">
                      Type DELETE to confirm account erasure
                    </label>
                    <input
                      id="erase-confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="rounded-btn border border-line-strong bg-surface-1 px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-dim outline-none focus:border-brand transition-colors"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void eraseAccount()}
                        disabled={busy !== null || confirmText !== "DELETE"}
                        className="flex-1 rounded-btn border border-transparent bg-brand text-on-brand px-4 py-2 font-mono text-xs font-semibold shadow-sm hover:bg-brand-strong transition-all disabled:opacity-40"
                      >
                        {busy === "delete" ? "Erasing…" : "Permanently erase"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowErase(false);
                          setConfirmText("");
                        }}
                        disabled={busy !== null}
                        className="px-3 py-2 font-mono text-xs text-fg-dim hover:text-fg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-fg-dim">
              Erasure removes your app data (including rendered videos) and anonymizes shared
              records. Your authentication record in Clerk is removed by our team — contact support
              if it is not gone within 30 days.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
