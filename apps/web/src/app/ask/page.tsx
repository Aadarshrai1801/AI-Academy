"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ApiError,
  apiFetch,
  type AskHistoryItem,
  type AskResult,
  type QuotaState,
  type VideoRequestResult,
} from "@/lib/api";

export default function AskPage() {
  const { getToken, isLoaded } = useAuth();
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [history, setHistory] = useState<AskHistoryItem[]>([]);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoRequestResult | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoStage, setVideoStage] = useState<"queued" | "script" | "render" | "ready">("queued");

  const refresh = useCallback(async () => {
    const token = await getToken();
    const [h, q] = await Promise.all([
      apiFetch<{ items: AskHistoryItem[] }>("/ai/history?limit=10", { token }),
      apiFetch<QuotaState>("/quota/check?feature=ai_text", { token }),
    ]);
    setHistory(h.items);
    setQuota(q);
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      void refresh().catch(() => undefined);
    }
  }, [isLoaded, refresh]);

  async function ask() {
    if (draft.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<AskResult>("/ai/ask", {
        method: "POST",
        token: await getToken(),
        body: { question: draft.trim() },
      });
      setResult(r);
      setVideo(null);
      setDraft("");
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError(
          `Daily AI answer quota reached (${e.payload.limit}/day). Quota resets at 00:00 UTC. Pro tier includes 100 queries daily.`,
        );
      } else {
        setError(e instanceof Error ? e.message : "Inference request failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function openQuery(id: string) {
    try {
      const r = await apiFetch<AskResult>(`/ai/queries/${id}`, { token: await getToken() });
      setResult(r);
      setVideo(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open past query.");
    }
  }

  async function makeVideo() {
    if (!result || videoBusy) return;
    setVideoBusy(true);
    try {
      const r = await apiFetch<VideoRequestResult>("/ai/videos", {
        method: "POST",
        token: await getToken(),
        body: { queryId: result.id },
      });
      setVideo(r);
      setVideoStage(r.cached ? "ready" : "script");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError(
          (e.payload.proRequired as boolean)
            ? "New explainer video generation is reserved for Pro members. Free tier users can view previously cached videos."
            : `Monthly video generation quota reached (${e.payload.limit}/mo).`,
        );
      } else {
        setError(e instanceof Error ? e.message : "Video synthesis request failed.");
      }
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* Crown Header */}
      <div className="border-b border-[var(--seam)] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
          <span>AI TUTOR //</span>
          <span className="text-[var(--tungsten)]">ASYNC REASONING ENGINE</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
          Ask AI
        </h1>
        <p className="mt-1 text-xs text-[var(--ink-lead)]">
          Technical AI/ML inquiries only. Queries return immediate mathematical proofs, architectural notes, and async visual explainer videos.{" "}
          {quota ? (
            <span className="font-mono text-[var(--ink-chalk)]">
              ({quota.remaining === -1 ? "Unlimited queries" : `${quota.remaining}/${quota.limit} fresh queries remaining today`})
            </span>
          ) : null}
        </p>
      </div>

      {/* Input Console */}
      <div className="mt-6 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-4">
        <label htmlFor="ai-query-input" className="sr-only">
          Your machine learning inquiry
        </label>
        <textarea
          id="ai-query-input"
          aria-label="Your machine learning inquiry"
          className="min-h-24 w-full rounded-md border border-[var(--seam)] bg-[var(--panel)] p-3.5 font-mono text-xs leading-5 text-[var(--ink-chalk)] placeholder-[var(--ink-dim)] focus-visible:border-[var(--tungsten)]"
          placeholder="e.g. Why does RMSNorm converge faster than standard LayerNorm in LLaMA architectures? Show mathematical proof."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[11px] text-[var(--ink-lead)]">
            Min 10 characters · Supports LaTeX math & tensor syntax
          </span>
          <button
            onClick={ask}
            disabled={draft.trim().length < 10 || busy}
            className="flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>{busy ? "Evaluating…" : "Ask engine"}</span>
            <span className="rounded bg-black/20 px-1 py-0.5 font-mono text-[10px] text-black/80">
              ↵
            </span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-lg border border-[var(--diverged)]/40 bg-[var(--diverged)]/10 p-4 text-xs text-[var(--ink-chalk)]">
          <div className="font-mono font-semibold text-[var(--diverged)]">Query notice</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <article className="mt-6 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--seam)] pb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[var(--ink-lead)]">STATUS:</span>
              {result.cached ? (
                <span className="rounded bg-[var(--converged)]/10 px-2 py-0.5 font-mono text-[11px] text-[var(--converged)]">
                  ⚡ INSTANT CANONICAL CACHE
                </span>
              ) : (
                <span className="rounded bg-[var(--tungsten)]/10 px-2 py-0.5 font-mono text-[11px] text-[var(--tungsten)]">
                  FRESH INFERENCE
                </span>
              )}
            </div>

            {/* Video Trigger Button / Status */}
            <div>
              {video ? (
                <Link
                  href={`/watch/${video.jobId}`}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--tungsten)] bg-[var(--tungsten)]/10 px-2.5 py-1 font-mono text-[11px] text-[var(--tungsten)] hover:bg-[var(--tungsten)]/20"
                >
                  <span>▶</span>
                  <span>{video.cached ? "Watch cached video" : "View render chamber"}</span>
                </Link>
              ) : (
                <button
                  onClick={makeVideo}
                  disabled={videoBusy}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--seam)] bg-[var(--panel)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-chalk)] hover:border-[var(--tungsten)] disabled:opacity-40"
                >
                  <span>🎬</span>
                  <span>{videoBusy ? "Queuing worker…" : "Synthesize visual explainer"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Async Video Synthesis Chamber (Non-anxious waiting beat) */}
          {video && !video.cached && (
            <div className="mt-4 rounded-lg border border-[var(--tungsten)]/30 bg-[var(--tungsten)]/5 p-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--tungsten)] animate-pulse" />
                  <span className="font-mono font-medium text-[var(--tungsten)]">
                    VIDEO SYNTHESIS CHAMBER
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-lead)]">
                  Job ID: {video.jobId.slice(0, 8)}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 rounded-full bg-[var(--seam)] h-1.5 overflow-hidden">
                  <div className="h-full bg-[var(--tungsten)] w-2/3 animate-pulse" />
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-chalk)]">~2 min remaining</span>
              </div>

              <p className="mt-2 text-[11px] text-[var(--ink-lead)]">
                Compiling multi-slide visual storyboard and rendering MP4. You may leave this page or practice questions — your synthesized video is saved to your account automatically.
              </p>

              <div className="mt-3">
                <Link
                  href={`/watch/${video.jobId}`}
                  className="font-mono text-xs text-[var(--tungsten)] hover:underline"
                >
                  Open dedicated player view →
                </Link>
              </div>
            </div>
          )}

          {/* Answer Text */}
          <div className="mt-4 prose prose-invert max-w-none text-xs leading-relaxed text-[var(--ink-chalk)]">
            <p className="whitespace-pre-wrap font-sans">{result.answer}</p>
          </div>

          {/* YouTube Verified Recommendations */}
          {result.youtube && result.youtube.length > 0 && (
            <div className="mt-6 border-t border-[var(--seam)] pt-4">
              <h3 className="font-mono text-xs text-[var(--ink-lead)]">
                RECOMMENDED TECHNICAL LECTURES & CITATIONS //
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.youtube.map((v) => (
                  <a
                    key={v.video_id}
                    href={`https://www.youtube.com/watch?v=${v.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col overflow-hidden rounded-md border border-[var(--seam)] bg-[var(--panel)] transition-colors hover:border-[var(--seam-highlight)]"
                  >
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail_url}
                        alt=""
                        className="aspect-video w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                      />
                    ) : null}
                    <div className="p-3">
                      <div className="text-xs font-medium leading-4 text-[var(--ink-chalk)] group-hover:text-[var(--tungsten)]">
                        {v.title}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-[var(--ink-lead)]">
                        {v.channel}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      )}

      {/* History Panel */}
      {history.length > 0 && (
        <section className="mt-8 border-t border-[var(--seam)] pt-6">
          <h2 className="font-mono text-xs text-[var(--ink-lead)]">
            RECENT INQUIRIES //
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => openQuery(h.id)}
                className="flex items-center justify-between rounded-md border border-[var(--seam)] bg-[var(--chassis)] p-3 text-left text-xs transition-colors hover:border-[var(--seam-highlight)] hover:bg-[var(--panel)]"
              >
                <div className="flex items-center gap-2 truncate pr-4">
                  <span className="font-mono text-xs text-[var(--ink-lead)]">
                    {h.cached ? "⚡" : "💬"}
                  </span>
                  <span className="truncate text-[var(--ink-chalk)]">{h.question}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-lead)] flex-shrink-0">
                  Inspect →
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
