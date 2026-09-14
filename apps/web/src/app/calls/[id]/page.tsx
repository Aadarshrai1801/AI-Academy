"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch, type JoinResult } from "@/lib/api";

/** Inline report dialog — replaces window.prompt/alert (blocked in some browsers,
 * inaccessible to screen readers, and untestable). */
function ReportDialog({
  busy,
  reason,
  onReason,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  reason: string;
  onReason: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report session"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-5 shadow-2xl">
        <h2 className="font-mono text-sm font-semibold text-[var(--ink-chalk)]">Report session</h2>
        <p className="mt-1 font-mono text-[11px] text-[var(--ink-lead)]">
          Describe the problem (abuse, spam, technical issue). Moderators review every report.
        </p>
        <label htmlFor="report-reason" className="sr-only">
          Report reason
        </label>
        <textarea
          id="report-reason"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={300}
          rows={3}
          autoFocus
          placeholder="Reason…"
          className="mt-3 w-full rounded border border-[var(--seam)] bg-[var(--substrate)] p-2 font-mono text-xs text-[var(--ink-chalk)] outline-none focus:border-[var(--tungsten)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-[var(--seam)] px-3 py-1.5 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={busy || reason.trim().length === 0}
            className="rounded border border-[var(--tungsten)] bg-[var(--tungsten)] px-3 py-1.5 font-mono text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CallRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [join, setJoin] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const doJoin = useCallback(async () => {
    try {
      const j = await apiFetch<JoinResult>(`/calls/${id}/join`, {
        method: "POST",
        token: await getToken(),
      });
      setJoin(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed.");
    }
  }, [getToken, id]);

  useEffect(() => {
    if (isLoaded) {
      void doJoin();
    }
  }, [isLoaded, doJoin]);

  async function leave(end: boolean) {
    try {
      const token = await getToken();
      await apiFetch(`/calls/${id}/leave`, { method: "POST", token });
      if (end) {
        await apiFetch(`/calls/${id}/end`, { method: "POST", token }).catch(() => undefined);
      }
    } finally {
      setLeft(true);
      router.push("/calls");
    }
  }

  const report = useCallback(() => setReportOpen(true), []);

  async function submitReport() {
    const reason = reportReason.trim();
    if (!reason || reportBusy) return;
    setReportBusy(true);
    try {
      await apiFetch(`/calls/${id}/report`, {
        method: "POST",
        token: await getToken(),
        body: { reason },
      });
      setReportOpen(false);
      setReportReason("");
      setReportSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
      setReportOpen(false);
    } finally {
      setReportBusy(false);
    }
  }

  let content: React.ReactNode;
  if (error) {
    content = (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/calls" className="font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]">
          RETURN TO CALLS
        </Link>
        <div className="mt-4 rounded-lg border border-[var(--diverged)]/40 bg-[var(--diverged)]/10 p-6 text-xs text-[var(--ink-chalk)]">
          <div className="font-mono font-semibold text-[var(--diverged)]">Room Connection Error</div>
          <p className="mt-1">{error}</p>
        </div>
      </main>
    );
  } else if (left || !join) {
    content = (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--ink-lead)]">
        {left ? "Call terminated." : "Negotiating media connection…"}
      </main>
    );
  } else if (!join.token) {
    content = (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/calls" className="font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]">
          RETURN TO CALLS
        </Link>
        <div className="mt-4 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--tungsten)]">
            <span>SESSION INITIALIZED</span>
            <span>{"//"}</span>
            <span>MEDIA KEYS PENDING</span>
          </div>
          <h1 className="mt-2 text-lg font-bold text-[var(--ink-chalk)]">
            Live Room Created — Awaiting Media Stream Configuration
          </h1>
          <p className="mt-2 text-xs text-[var(--ink-lead)] leading-relaxed">
            The session ({join.call.type}, {join.call.participant_ids.length} participant(s)) is tracked with server-side duration caps. Add Cloudflare RealtimeKit credentials to the API `.env` to start live WebRTC video streams.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => leave(true)}
              className="rounded border border-[var(--diverged)]/40 px-3 py-1.5 font-mono text-xs text-[var(--diverged)] hover:bg-[var(--diverged)]/10"
            >
              End call for all
            </button>
            <button
              onClick={report}
              className="rounded border border-[var(--seam)] px-3 py-1.5 font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
            >
              Report session
            </button>
          </div>
        </div>
      </main>
    );
  } else {
    content = (
      <RtkRoom
        key={join.token.slice(-12)}
        authToken={join.token}
        isGroup={join.call.type === "group"}
        onLeave={() => leave(false)}
        onEnd={() => leave(true)}
        onReport={report}
      />
    );
  }

  return (
    <>
      {content}
      {reportSent && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-[var(--converged)]/50 bg-[var(--chassis)] px-4 py-2 font-mono text-xs text-[var(--ink-chalk)] shadow-xl"
        >
          Report submitted for review.
          <button
            onClick={() => setReportSent(false)}
            aria-label="Dismiss report confirmation"
            className="ml-3 text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
          >
            ✕
          </button>
        </div>
      )}
      {reportOpen && (
        <ReportDialog
          busy={reportBusy}
          reason={reportReason}
          onReason={setReportReason}
          onCancel={() => setReportOpen(false)}
          onSubmit={() => void submitReport()}
        />
      )}
    </>
  );
}

type RtkCore = typeof import("@cloudflare/realtimekit-react");
type RtkUi = typeof import("@cloudflare/realtimekit-react-ui");

function RtkRoom(props: {
  authToken: string;
  isGroup: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onReport: () => void;
}) {
  const [mods, setMods] = useState<{ core: RtkCore; ui: RtkUi } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      import("@cloudflare/realtimekit-react"),
      import("@cloudflare/realtimekit-react-ui"),
    ]).then(([core, ui]) => {
      if (live) setMods({ core, ui });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!mods) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--ink-lead)]">
        Connecting Cloudflare media transport…
      </main>
    );
  }

  return <RtkRoomInner core={mods.core} ui={mods.ui} {...props} />;
}

function RtkRoomInner(props: {
  core: RtkCore;
  ui: RtkUi;
  authToken: string;
  isGroup: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onReport: () => void;
}) {
  const { core, ui, authToken } = props;
  const { useRealtimeKitClient, RealtimeKitProvider } = core;
  const { RtkMeeting } = ui;
  const [meeting, initMeeting] = useRealtimeKitClient();

  useEffect(() => {
    void initMeeting({ authToken });
  }, [initMeeting, authToken]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--seam)] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--converged)] animate-pulse" aria-hidden="true" />
          <span className="font-mono font-semibold text-[var(--ink-chalk)]">
            {props.isGroup ? "GROUP STUDY SESSION // LIVE" : "1:1 PEER REVIEW SESSION // LIVE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={props.onReport}
            className="font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]"
          >
            Report
          </button>
          <button
            onClick={props.onEnd}
            className="rounded border border-[var(--diverged)]/40 px-3 py-1 font-mono text-xs text-[var(--diverged)] hover:bg-[var(--diverged)]/10"
          >
            End call
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--seam)] bg-[var(--chassis)] shadow-2xl">
        <RealtimeKitProvider value={meeting}>
          <RtkMeeting meeting={meeting} showSetupScreen mode="fill" />
        </RealtimeKitProvider>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--ink-lead)]">
        <span>Free calls auto-end at 15m (server-enforced cap). Pro accounts enjoy unlimited duration.</span>
        <span>Cloudflare RealtimeKit WebRTC</span>
      </div>
    </main>
  );
}
