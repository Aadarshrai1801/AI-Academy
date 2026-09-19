/**
 * /watch/[jobId] — the explainer player (design plan §4.4).
 *
 * Why this looks this way:
 * - Video is the one real "object" in the app, so it gets the media surface
 *   (dark frame, its own radius) rather than the card shell.
 * - The playlist is genuinely ordered, so numbered steps are honest here;
 *   "video 2 of 3" + "Next video" carry the sequence structurally.
 * - The end-of-playlist check lives on the same page and in the growth family,
 *   so watching flows into doing without feeling like a different app.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  API_URL,
  apiFetch,
  TOPIC_LABELS,
  type SequenceCheckDTO,
  type VideoJobDTO,
  type VideoSequenceDTO,
} from "@/lib/api";
import { DifficultyBadge, buttonStyles } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function WatchPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { getToken, isLoaded } = useAuth();
  const [job, setJob] = useState<VideoJobDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<VideoSequenceDTO | null>(null);
  const [check, setCheck] = useState<SequenceCheckDTO | null>(null);

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

  // Topic playlist + end-of-playlist check (Phase 10). Loaded once the video
  // is ready and the job carries a topic; failures are non-fatal enhancements.
  useEffect(() => {
    if (!job?.topicId || job.status !== "ready") return;
    let live = true;
    const topicId = job.topicId;
    const currentJobId = job.id;
    void (async () => {
      try {
        const token = await getToken();
        const seq = await apiFetch<VideoSequenceDTO>(`/ai/videos/sequence/${topicId}`, { token });
        if (!live) return;
        setPlaylist(seq);
        const last = seq.items[seq.items.length - 1];
        if (last && last.id === currentJobId) {
          const chk = await apiFetch<SequenceCheckDTO>(
            `/ai/videos/sequence/${topicId}/check?count=2`,
            { token },
          );
          if (live) setCheck(chk);
        }
      } catch {
        /* playlist/check are progressive enhancements */
      }
    })();
    return () => {
      live = false;
    };
  }, [job?.topicId, job?.id, job?.status, getToken]);

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
            className="font-mono text-xs text-[var(--fg-dim)] hover:text-fg transition-colors"
          >
            ← RETURN TO ASK AI
          </Link>
          <span className="text-xs text-[var(--line-strong)]">/</span>
          <span className="text-xs text-fg-dim">job {jobId.slice(0, 8)}</span>
        </div>
        {job && (
          <div className="rounded-btn border border-[var(--line)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] text-[var(--fg-muted)]">
            status: <span className="font-medium text-fg">{job.status}</span>
          </div>
        )}
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">
        Explainer
      </h1>

      {error && (
        <div className="mt-4 rounded-card border border-error/40 bg-state-negative-soft p-4 text-xs text-fg">
          <div className="font-semibold text-state-negative-ink">Something went wrong</div>
          <p className="mt-1 text-fg-muted">{error}</p>
        </div>
      )}

      {/* Generating / Polling State */}
      {job && (job.status === "queued" || job.status === "generating") && (
        <div className="surface-card mt-6 p-6">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
              <span className="text-sm font-medium text-fg">
                {job.stage === "script" && "Writing the explainer script…"}
                {job.stage === "audio" && "Pacing the narration…"}
                {job.stage === "render" && "Rendering the slides…"}
                {!["script", "audio", "render"].includes(job.stage) && "Waiting for a render slot…"}
              </span>
            </div>
            <span className="font-mono text-[11px] text-fg font-semibold tabular-nums">
              {job.progress}%
            </span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full bg-brand shadow-xs transition-all duration-500"
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
        <div className="mt-6 rounded-card border border-error/40 bg-state-negative-soft p-6 text-xs text-fg">
          <div className="font-semibold text-state-negative-ink">Rendering failed</div>
          <p className="mt-1 text-fg-muted">
            {job.error ? `${job.error}. ` : ""}Your monthly video quota was refunded automatically.
            You can try again with a different question.
          </p>
          <div className="mt-3">
            <Link
              href="/ask"
              className="font-medium text-fg underline underline-offset-4 hover:text-fg-muted"
            >
              Try another question
            </Link>
          </div>
        </div>
      )}

      {/* Video Player (The "Ready" Moment) */}
      {job?.status === "ready" && fileSrc && (
        <div className="mt-6 animate-video-unfurl">
          <div className="overflow-hidden surface-media">
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

      {/* Topic playlist (3-5 videos) — numbered because the sequence is real. */}
      {job?.status === "ready" && playlist && playlist.items.length > 0 && (
        <section className="surface-card mt-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">
              {TOPIC_LABELS[playlist.topicId] ?? playlist.topicId} playlist
            </h2>
            <span className="text-[11px] text-fg-dim">
              video {playlist.items.findIndex((item) => item.id === job.id) + 1} of{" "}
              {playlist.items.length}
            </span>
          </div>
          <ol className="mt-3 flex flex-wrap gap-2">
            {playlist.items.map((item, i) => {
              const active = item.id === job.id;
              return (
                <li key={item.id}>
                  <Link
                    href={`/watch/${item.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-btn border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-fg bg-brand-soft font-semibold text-fg"
                        : "border-[var(--line)] bg-[var(--surface-2)] text-fg-muted hover:border-[var(--line-strong)] hover:text-fg",
                    )}
                  >
                    <span className="font-mono text-[11px] tabular-nums text-fg-dim">{i + 1}</span>
                    <span className="max-w-[16rem] truncate">
                      {item.script?.title ?? `Explainer ${i + 1}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {(() => {
            const i = playlist.items.findIndex((item) => item.id === job.id);
            const next = i >= 0 ? playlist.items[i + 1] : undefined;
            return next ? (
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <Link href={`/watch/${next.id}`} className={buttonStyles("secondary", "sm")}>
                  Next video →
                </Link>
              </div>
            ) : null;
          })()}
        </section>
      )}

      {/* End-of-playlist check — same surface as the player, so finishing a
          video flows into doing without an app-switch feeling. */}
      {job?.status === "ready" && check && check.items.length > 0 && (
        <section className="mt-6 rounded-card border border-growth/30 bg-growth-soft p-5">
          <h2 className="text-sm font-semibold text-fg">Check yourself before you go</h2>
          <p className="mt-1 text-xs text-fg-muted">
            You reached the end of the playlist. {check.items.length === 1 ? "One question" : "Two questions"}{" "}
            from {TOPIC_LABELS[check.topicId] ?? check.topicId} to lock it in — misses are fine,
            that&apos;s what practice is for.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {check.items.map((q) => (
              <li
                key={q.id}
                className="flex flex-col justify-between rounded-work border border-[var(--line)] bg-[var(--surface-1)] p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="text-[11px] text-fg-dim">
                      {q.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-fg">{q.prompt}</p>
                </div>
                <Link href={`/practice?q=${q.id}`} className={buttonStyles("primary", "sm")}>
                  Answer this
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Chapters & Storyboard */}
      {job?.script && (
        <section className="mt-8 border-t border-[var(--line)] pt-6">
          <h2 className="text-sm font-semibold text-fg">Chapter breakdown</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {job.script.scenes.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 text-xs transition-colors hover:border-[var(--line-strong)]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-fg">
                    Scene {i + 1}: {s.heading}
                  </div>
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-[var(--fg-muted)]">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs italic text-fg-dim">
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
