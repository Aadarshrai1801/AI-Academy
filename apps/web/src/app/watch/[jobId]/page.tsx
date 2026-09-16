"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { API_URL, apiFetch, type VideoJobDTO } from "@/lib/api";

export default function WatchPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { getToken, isLoaded } = useAuth();
  const [job, setJob] = useState<VideoJobDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch<VideoJobDTO>(`/ai/videos/${jobId}`, {
        token: await getToken(),
      });
      setJob(j);
      setError(null);
      return j.status;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load video synthesis state.");
      return "error";
    }
  }, [getToken, jobId]);

  useEffect(() => {
    if (!isLoaded) return;
    let stop = false;
    const tick = async () => {
      const s = await load();
      if (!stop && (s === "queued" || s === "generating")) setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [isLoaded, jobId, load]);

  // Cloud mode: videoUrl is an absolute R2 URL (public or presigned) — play
  // it directly. Local fallback: videoUrl is API-relative, or use the signed
  // fileToken URL (API auth-checks then 302-redirects to R2 / streams disk).
  const fileSrc =
    job?.status !== "ready"
      ? null
      : job.videoUrl && job.videoUrl.startsWith("http")
        ? job.videoUrl
        : job.fileToken
          ? `${API_URL}${job.fileToken.url}`
          : job.videoUrl
            ? `${API_URL}${job.videoUrl}`
            : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/ask"
            className="font-mono text-xs text-[var(--fg-dim)] hover:text-white transition-colors"
          >
            ← RETURN TO ASK AI
          </Link>
          <span className="text-xs text-[var(--line-strong)]">/</span>
          <span className="font-mono text-xs text-white">JOB // {jobId.slice(0, 8)}</span>
        </div>
        {job && (
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-2.5 py-1 font-mono text-[11px] text-[var(--fg-muted)]">
            STATUS: <span className="font-semibold text-white uppercase">{job.status}</span>
          </div>
        )}
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">
        Visual Explainer Synthesis
      </h1>

      {error && (
        <div className="mt-4 rounded-xl border border-white/20 bg-white/[0.04] p-4 text-xs text-white">
          <div className="font-mono font-semibold uppercase tracking-wider text-white">Synthesis error</div>
          <p className="mt-1 text-[var(--fg-muted)]">{error}</p>
        </div>
      )}

      {/* Generating / Polling State */}
      {job && (job.status === "queued" || job.status === "generating") && (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-6 shadow-card">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
              <span className="font-mono font-medium text-[var(--fg)]">
                {job.stage === "script" && "SYNTHESIZING RIGOROUS EXPLAINER SCRIPT…"}
                {job.stage === "audio" && "PACING NARRATION & MATHEMATICAL PROOFS…"}
                {job.stage === "render" && "RENDERING FFMPEG SLIDE FRAMES…"}
                {!["script", "audio", "render"].includes(job.stage) && "PROCESSING WORKER QUEUE…"}
              </span>
            </div>
            <span className="font-mono text-[11px] text-white font-semibold tabular-nums">
              {job.progress}%
            </span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)] transition-all duration-500"
              style={{ width: `${Math.max(8, job.progress)}%` }}
            />
          </div>

          <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
            Worker compiling visual diagrams and equations. Auto-refreshes every 3 seconds.
          </p>
        </div>
      )}

      {/* Failed State */}
      {job?.status === "failed" && (
        <div className="mt-6 rounded-xl border border-white/20 bg-white/[0.04] p-6 text-xs text-white">
          <div className="font-mono font-semibold uppercase tracking-wider text-white">Synthesis failure</div>
          <p className="mt-1 text-[var(--fg-muted)]">
            Render failed{job.error ? `: ${job.error}` : "."} Your monthly video quota was automatically refunded.
          </p>
          <div className="mt-3">
            <Link href="/ask" className="font-mono text-white underline underline-offset-4 hover:text-[var(--fg-muted)]">
              Retry with new prompt
            </Link>
          </div>
        </div>
      )}

      {/* Video Player (The "Ready" Moment) */}
      {job?.status === "ready" && fileSrc && (
        <div className="mt-6 animate-video-unfurl">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-black shadow-2xl">
            <video
              key={fileSrc}
              controls
              preload="metadata"
              className="aspect-video w-full object-contain"
            >
              <source src={fileSrc} type="video/mp4" />
            </video>
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--fg-dim)]">
            <span>Duration: {job.durationSec ? `${job.durationSec}s` : "Complete"}</span>
            <span>Codec: H.264 / AAC</span>
          </div>
        </div>
      )}

      {/* Chapters & Storyboard */}
      {job?.script && (
        <section className="mt-8 border-t border-[var(--line)] pt-6">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
            CHAPTER BREAKDOWN //
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {job.script.scenes.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 text-xs transition-colors hover:border-[var(--line-strong)]"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-semibold text-[var(--fg)]">
                    Scene #{i + 1}: {s.heading}
                  </div>
                  <span className="font-mono text-[10px] text-[var(--fg-dim)] uppercase tracking-wider">
                    KEYFRAME {i + 1}
                  </span>
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-[var(--fg-muted)]">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-[11px] text-[var(--fg-dim)] italic">
                  &ldquo;{s.narration}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
