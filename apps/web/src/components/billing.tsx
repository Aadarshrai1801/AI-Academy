"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { API_URL } from "@/lib/api";

export function CheckoutButtons() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function start(plan: "pro_monthly" | "pro_annual") {
    setBusy(plan);
    setError(null);
    try {
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) {
        setError("Sign in with an email address first to link your membership.");
        return;
      }
      const res = await fetch(`${API_URL}/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ plan, email }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(
          res.status === 503
            ? "Stripe payment gateway is currently in test mode or keys are pending. You can still practice all free tiers."
            : (data.error ?? "Checkout could not be initialized."),
        );
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout connection failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => start("pro_monthly")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-transparent bg-brand text-on-brand px-6 py-3 font-mono text-xs font-semibold transition-all hover:bg-brand-strong disabled:opacity-50 shadow-sm"
        >
          {busy === "pro_monthly" ? "Connecting Stripe…" : "Upgrade Pro Monthly — $19/mo"}
        </button>
        <button
          onClick={() => start("pro_annual")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-6 py-3 font-mono text-xs font-medium text-[var(--fg)] transition-all hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {busy === "pro_annual" ? "Connecting Stripe…" : "Upgrade Pro Annual — $180/yr (Save 20%)"}
        </button>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-line-strong bg-surface-2 p-3 font-mono text-xs text-fg">
          {error}
        </div>
      )}
    </div>
  );
}
