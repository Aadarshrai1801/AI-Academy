"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Track } from "livekit-client";
import { apiFetch, type JoinResult } from "@/lib/api";

export default function CallRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [join, setJoin] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);
  const reportedShare = useRef(false);

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

  async function report() {
    const reason = prompt("Report reason (abuse, spam, other):");
    if (!reason) return;
    try {
      await apiFetch(`/calls/${id}/report`, {
        method: "POST",
        token: await getToken(),
        body: { reason },
      });
      alert("Report submitted for review.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
    }
  }

  if (error) {
    return (
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
  }

  if (left || !join) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--ink-lead)]">
        {left ? "Call terminated." : "Negotiating media connection…"}
      </main>
    );
  }

  if (!join.token) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/calls" className="font-mono text-xs text-[var(--ink-lead)] hover:text-[var(--ink-chalk)]">
          RETURN TO CALLS
        </Link>
        <div className="mt-4 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--tungsten)]">
            <span>SESSION INITIALIZED</span>
            <span>//</span>
            <span>MEDIA KEYS PENDING</span>
          </div>
          <h1 className="mt-2 text-lg font-bold text-[var(--ink-chalk)]">
            Live Room Created — Awaiting Media Stream Configuration
          </h1>
          <p className="mt-2 text-xs text-[var(--ink-lead)] leading-relaxed">
            The session ({join.call.type}, {join.call.participant_ids.length} participant(s)) is tracked with server-side duration caps. Add Cloudflare RealtimeKit credentials (or legacy LiveKit keys) to the API `.env` to start live WebRTC video streams.
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
  }

  if (join.provider === "rtk") {
    return (
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
    <LiveRoom
      key={join.token.slice(-12)}
      token={join.token}
      isGroup={join.call.type === "group"}
      onLeave={() => leave(false)}
      onEnd={() => leave(true)}
      onReport={report}
      onShare={() => {
        if (!reportedShare.current) {
          reportedShare.current = true;
          void getToken().then((t) =>
            apiFetch(`/calls/${id}/screen-share`, { method: "POST", token: t }).catch(
              () => undefined,
            ),
          );
        }
      }}
    />
  );
}

function LiveRoom(props: {
  token: string;
  isGroup: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onReport: () => void;
  onShare: () => void;
}) {
  const [lk, setLk] = useState<typeof import("@livekit/components-react") | null>(null);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

  useEffect(() => {
    let live = true;
    void import("@livekit/components-react").then((m) => {
      if (live) setLk(m);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!serverUrl || !lk) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center font-mono text-xs text-[var(--ink-lead)]">
        {!serverUrl
          ? "Configure NEXT_PUBLIC_LIVEKIT_URL in environment to connect video stream."
          : "Connecting LiveKit audio/video transport…"}
      </main>
    );
  }

  const { LiveKitRoom, RoomAudioRenderer, ControlBar } = lk;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
      {/* Session Crown */}
      <div className="mb-4 flex items-center justify-between border-b border-[var(--seam)] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--converged)] animate-pulse" />
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

      {/* Video Stage Frame */}
      <div className="overflow-hidden rounded-lg border border-[var(--seam)] bg-[var(--chassis)] shadow-2xl">
        <LiveKitRoom
          serverUrl={serverUrl}
          token={props.token}
          connect
          audio
          video
          onDisconnected={props.onLeave}
          data-lk-theme="default"
          style={{ height: "70vh" }}
        >
          <RoomView lk={lk} onShare={props.onShare} />
          <RoomAudioRenderer />
          <ControlBar />
        </LiveKitRoom>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--ink-lead)]">
        <span>Free calls auto-end at 15m (server-enforced cap). Pro accounts enjoy unlimited duration.</span>
        <span>WebRTC Encrypted (E2EE)</span>
      </div>
    </main>
  );
}

function RoomView(props: {
  lk: typeof import("@livekit/components-react");
  onShare: () => void;
}) {
  const { GridLayout, ParticipantTile, useTracks } = props.lk;
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const shared = tracks.some((t) => t.source === Track.Source.ScreenShare);
  useEffect(() => {
    if (shared) props.onShare();
  }, [shared, props]);

  return (
    <GridLayout tracks={tracks} style={{ height: "calc(70vh - 60px)" }}>
      <ParticipantTile />
    </GridLayout>
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
          <span className="h-2 w-2 rounded-full bg-[var(--converged)] animate-pulse" />
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
