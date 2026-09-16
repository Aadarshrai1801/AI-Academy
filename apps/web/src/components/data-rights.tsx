"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { apiFetch, ApiError } from "@/lib/api";

/**
 * GDPR/CCPA self-service controls (PRIVACY.md §7): download all stored data
 * (`GET /users/me/export`) and erase the account (`DELETE /users/me`).
 * The erase flow requires typing DELETE so it cannot happen by accident.
 */
export function DataRights() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [erased, setErased] = useState(false);
  const [showErase, setShowErase] = useState(false);

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
    <section className="mt-8 border-t border-line pt-6">
      <div className="flex items-center gap-2 font-mono text-xs text-fg-dim">
        <span>DATA &amp; PRIVACY {"//"}</span>
        <span className="text-fg-muted">YOUR RIGHTS</span>
      </div>
      <div className="mt-3 rounded-card border border-line bg-surface-2 p-5">
        <p className="text-xs leading-relaxed text-fg-muted">
          Download everything we store about you, or permanently erase your account and data.
          See the{" "}
          <Link href="/privacy" className="text-fg underline-offset-4 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-fg underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>

        {error && (
          <p role="alert" className="mt-3 font-mono text-xs text-fg-dim border border-line-strong bg-surface-3 p-2.5 rounded-md">
            {error}
          </p>
        )}

        {erased ? (
          <p role="status" className="mt-4 font-mono text-xs text-fg font-medium border border-line-strong bg-surface-3 p-2.5 rounded-md">
            Account erased. You have been signed out.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => void exportData()}
              disabled={busy !== null}
              className="rounded-btn border border-line bg-surface-3 px-4 py-2 font-mono text-xs text-fg hover:border-line-strong hover:bg-surface-4 transition-colors disabled:opacity-50"
            >
              {busy === "export" ? "Preparing export…" : "Download my data"}
            </button>
            {!showErase ? (
              <button
                onClick={() => setShowErase(true)}
                disabled={busy !== null}
                className="rounded-btn border border-dashed border-line-strong px-4 py-2 font-mono text-xs text-fg-dim hover:text-fg hover:border-fg transition-colors disabled:opacity-50"
              >
                Delete my account
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="erase-confirm" className="sr-only">
                  Type DELETE to confirm account erasure
                </label>
                <input
                  id="erase-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="rounded-btn border border-line-strong bg-surface-1 px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-dim outline-none focus:border-fg transition-colors"
                />
                <button
                  onClick={() => void eraseAccount()}
                  disabled={busy !== null || confirmText !== "DELETE"}
                  className="rounded-btn border border-transparent bg-fg text-surface-0 px-4 py-2 font-mono text-xs font-semibold shadow-sm hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {busy === "delete" ? "Erasing…" : "Permanently erase"}
                </button>
                <button
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
            )}
          </div>
        )}
        <p className="mt-3 text-[11px] text-fg-dim">
          Erasure removes your app data (including rendered videos) and anonymizes shared
          records. Your authentication record in Clerk is removed by our team — contact support
          if it is not gone within 30 days.
        </p>
      </div>
    </section>
  );
}
