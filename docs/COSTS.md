# AI Academy cost control & scaling notes (spec §5.4, Phase 7 pass)

All figures are order-of-magnitude; re-check before signing contracts.

## Current posture (all keys optional, graceful degradation everywhere)

| Lever | Implementation | Where |
|---|---|---|
| AI text answers | Canonical cache (`canonicals.times_reused`); cache hits are quota-free and LLM-free | `apps/api/src/ai/` |
| AI question gen | Daily unit budget (`GENERATION_DAILY_BUDGET`, default 500), concurrency 2, quality gate drops junk before insert | `generation.service.ts` |
| Explainer video | Monthly render budget (`VIDEO_MONTHLY_BUDGET`, default 200, 503 circuit breaker); free tier cached-only; quota refund on failure; local ffmpeg renders (≈$0 compute, ~120KB/mp4) | `video.service.ts` |
| YouTube | 7-day result cache (10k units/day quota); stale-served on failure | `youtube.service.ts` |
| Calls (SFU) | Server-side hard stops (15 min free / 240 min pro backstop), per-minute quota billing, room auto-delete | `calls.service.ts` |
| Redis memory | Every counter/key carries a TTL (quotas 1–31d, throttle 120s, boards 3d, budgets ~month) | `entitlements`, `policy.ts`, services |
| Edge abuse | Global 120 req/min guard (`RATE_LIMIT_PER_MIN`) + per-feature quotas | `throttle.guard.ts` |

## Spend visibility (check weekly until PMF, then automate alerts)

- `GET /ai/stats` (admin): queries/day, cache hit-rate — **the** text-cost KPI.
- `GET /ai/videos/stats` (admin): renders/month vs budget, est. cost.
- `GET /admin/analytics`: DAU, attempts, AI volume, videos, call minutes, MRR.
- `GET /admin/generation/status`: provider, buffer deficits, job depth, gen budget.

Alert rule of thumb: page when hit-rate < 50% (cache key problem) or any
budget counter > 80% before month-end.

## Self-host triggers (spec §4: managed now, migrate on math)

- **Redis (Upstash/Redis Cloud):** move when monthly bill > ~1 engineer-hour of
  ops; workload is simple keys + BullMQ — a single container suffices for a long time.
- **LiveKit Cloud:** move when SFU minutes dominate COGS; self-hosted LiveKit
  is one container + TURN (coturn). Keep Cloud until call volume justifies ops.
- **MongoDB Atlas:** stay; vector search arrives free-ish via Atlas when an
  embeddings key exists (no separate Pinecone bill).
- **Video renders:** local ffmpeg is already $0 marginal; only TTS voice spend
  is new (per-character pricing — cap narration length, already ≤600 chars/scene).

## When keys arrive (no code changes, env only)

`ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` → real answers/scripts/questions.
`YOUTUBE_API_KEY` → live recommendations (cache absorbs repeats).
`ABLY_API_KEY` → live chat (polling stops). `LIVEKIT_*` → real media.
`ELEVENLABS_API_KEY` → voiced narration (implement `TtsProvider`, ~30 lines).
`STRIPE_*` → billing + MRR in admin analytics. `R2_*` → cloud video storage.
