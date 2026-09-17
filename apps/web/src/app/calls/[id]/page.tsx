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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report session"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5 shadow-2xl">
        <h2 className="font-mono text-sm font-semibold text-[var(--fg)]">Report session</h2>
        <p className="mt-1 font-mono text-[11px] text-[var(--fg-muted)]">
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
          className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5 font-mono text-xs text-[var(--fg)] outline-none focus:border-brand transition-colors placeholder:text-[var(--fg-dim)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-fg transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={busy || reason.trim().length === 0}
            className="rounded-md border border-transparent bg-brand text-on-brand px-3.5 py-1.5 font-mono text-xs font-semibold hover:bg-brand-strong transition-all disabled:opacity-30 shadow-sm"
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <Link href="/calls" className="font-mono text-xs text-[var(--fg-dim)] hover:text-fg transition-colors">
          ← RETURN TO CALLS
        </Link>
        <div className="mt-4 rounded-xl border border-line-strong bg-surface-2 p-6 text-xs text-[var(--fg)]">
          <div className="font-mono font-semibold uppercase tracking-wider text-fg">Room Connection Notice</div>
          <p className="mt-1 text-[var(--fg-muted)]">{error}</p>
        </div>
      </main>
    );
  } else if (left || !join) {
    content = (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--fg-dim)]">
        {left ? "Call terminated." : "Negotiating media connection…"}
      </main>
    );
  } else if (!join.token) {
    content = (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/calls" className="font-mono text-xs text-[var(--fg-dim)] hover:text-fg transition-colors">
          ← RETURN TO CALLS
        </Link>
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--fg-dim)]">
            <span>SESSION INITIALIZED</span>
            <span className="text-[var(--line-strong)]">{"//"}</span>
            <span className="text-fg font-medium">MEDIA KEYS PENDING</span>
          </div>
          <h1 className="mt-2 text-lg font-bold text-[var(--fg)]">
            Live Room Created — Awaiting Media Stream Configuration
          </h1>
          <p className="mt-2 text-xs text-[var(--fg-muted)] leading-relaxed">
            The session ({join.call.type}, {join.call.participant_ids.length} participant(s)) is tracked with server-side duration caps. Add Cloudflare RealtimeKit credentials to the API `.env` to start live WebRTC video streams.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => leave(true)}
              className="rounded-md border border-line-strong px-3.5 py-1.5 font-mono text-xs text-fg hover:bg-surface-3 transition-all"
            >
              End call for all
            </button>
            <button
              onClick={report}
              className="rounded-md border border-[var(--line)] px-3.5 py-1.5 font-mono text-xs text-[var(--fg-muted)] hover:border-[var(--line-strong)] hover:text-fg transition-all"
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
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-line-strong bg-surface-2 px-4 py-2.5 font-mono text-xs text-fg shadow-card"
        >
          Report submitted for review.
          <button
            onClick={() => setReportSent(false)}
            aria-label="Dismiss report confirmation"
            className="ml-3 text-[var(--fg-dim)] hover:text-fg transition-colors"
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--fg-dim)]">
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
      <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
          <span className="font-mono font-semibold uppercase tracking-wider text-[var(--fg)]">
            {props.isGroup ? "GROUP STUDY SESSION // LIVE" : "1:1 PEER REVIEW SESSION // LIVE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={props.onReport}
            className="font-mono text-xs text-[var(--fg-muted)] hover:text-fg transition-colors"
          >
            Report
          </button>
          <button
            onClick={props.onEnd}
            className="rounded-md border border-line-strong px-3 py-1 font-mono text-xs text-fg hover:bg-surface-3 transition-all"
          >
            End call
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] shadow-2xl">
        <RealtimeKitProvider value={meeting}>
          <RtkMeeting meeting={meeting} showSetupScreen mode="fill" />
        </RealtimeKitProvider>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--fg-dim)]">
        <span>Free calls auto-end at 15m (server-enforced cap). Pro accounts enjoy unlimited duration.</span>
        <span>Cloudflare RealtimeKit WebRTC</span>
      </div>
    </main>
  );
}
