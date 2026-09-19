# Cost control & scaling

How the platform keeps AI and infrastructure spend bounded, where to watch it,
and when to self-host. All figures are order-of-magnitude — re-check before
signing contracts. See also [Operations](OPERATIONS.md) · [Architecture](ARCHITECTURE.md).

## 1. Current posture — every provider optional, graceful degradation

| Cost lever | Implementation | Code |
|---|---|---|
| AI text answers | Canonical answer cache (`canonicals.times_reused`) — cache hits are quota-free **and** LLM-free | `apps/api/src/ai/` |
| AI question generation | Daily unit budget (`GENERATION_DAILY_BUDGET`, default 500), concurrency 2, quality gate drops junk before insert | `generation.service.ts` |
| Explainer videos | Monthly render budget (`VIDEO_MONTHLY_BUDGET`, default 200 → 503 circuit breaker); free tier gets cached videos only; quota refunded on failure; local ffmpeg renders (~$0 compute, ~120 KB/mp4) | `video.service.ts` |
| YouTube recommendations | 7-day result cache (`AI_YOUTUBE_CACHE_DAYS`, 10k units/day quota); stale-served on failure | `youtube.service.ts` |
| Calls (SFU) | Server-side hard stops (15 min free / 240 min Pro backstop), per-minute quota accounting, room auto-delete | `calls.service.ts` |
| Redis memory | Every key carries a TTL (quotas 1–31 d, throttle 60 s, boards 3 d, budgets ~1 month) | `entitlements.service.ts`, `throttle.guard.ts` |
| Redis command budget | BullMQ idle traffic reduced (`REDIS_COMMAND_BUDGET_GUARD`) — see [Operations §10](OPERATIONS.md#10-metered-redis-upstash-and-bullmq-command-budgets) | `common/bull-connection.ts` |
| Edge abuse | Global 120 req/min guard (`RATE_LIMIT_PER_MIN`) + per-feature quotas (atomic, no phantom charges) | `throttle.guard.ts`, `entitlements.service.ts` |

**Cached content is never quota-gated (Phase 12 audit).** Serving is free at
every tier; entitlements only gate *fresh work*:

| Artifact | Access rule | Where enforced |
|---|---|---|
| Question bank (already generated) | Serve free; the practice quota is consumed on the first **graded attempt** per question/day, never on serving | `questions.service.ts`, `attempts.service.ts` |
| Canonical AI answer (cache hit) | Free for every tier, no `ai_text` spend | `ai.service.ts` (cache lookup before `consumeOrThrow`) |
| Mistake explanation (cache hit) | Free for every tier, separate hit-rate metric | `ai.service.ts` (`mistake_cache`) |
| Rendered video (`ready`) | Free to watch for every tier, including videos rendered by other users (canonical reuse) | `video.service.ts` (`request` reuse path; `status` allows ready jobs) |
| In-flight render / failed job | Owner (or admin) only — private work-in-progress | `video.service.ts` (`status`) |
| Fresh LLM calls / novel renders | Quota-gated (`ai_text`, `ai_video`) + spend budgets | `entitlements.service.ts` |

The hard-difficulty teaser (2/day free) is a deliberate product gate on
serve, not an accidental cache restriction.

**LLM provider:** Groq (OpenAI-compatible) with model rotation across
`GROQ_MODELS` — free-tier limits are per-model, so rotation multiplies
throughput at no cost. Without `GROQ_API_KEY` + `GROQ_MODEL`, the deterministic
stub provider runs instead (no spend, no code change).

## 2. Spend visibility

Check weekly until PMF, then automate alerts.

| Endpoint | Shows |
|---|---|
| `GET /ai/stats` (admin) | Queries/day, cache hit-rate — **the** text-cost KPI |
| `GET /ai/videos/stats` (admin) | Renders/month vs budget, estimated cost |
| `GET /admin/analytics` | DAU, attempts, AI volume, videos, call minutes, MRR |
| `GET /admin/generation/status` | Provider, buffer deficits, job depth, generation budget |
| `GET /metrics` | RED metrics + business counters (scrape into your monitoring) |

**Alert rule of thumb:** page when cache hit-rate < 50% (suggests a cache-key
problem) or when any budget counter exceeds 80% before period end.

## 3. Self-host triggers (managed now, migrate on math)

| Component | Move when | Reality check |
|---|---|---|
| Redis (Upstash/Redis Cloud) | Monthly bill > ~1 engineer-hour of ops | Workload is simple counters + BullMQ — a single container suffices for a long time |
| RealtimeKit (calls) | SFU minutes dominate COGS | Self-hosting means WebRTC infra + TURN (coturn) operations |
| MongoDB Atlas | Stay | Atlas vector search arrives free-ish when embeddings are added (no separate vector DB bill) |
| Video rendering | Already $0 marginal — local ffmpeg | Only new spend is TTS voice (per-character; narration capped ≤600 chars/scene) |

## 4. What new keys unlock (env-only, no code changes)

| Key(s) | Unlocks |
|---|---|
| `GROQ_API_KEY`, `GROQ_MODEL` | Real question generation, AI answers, video scripts |
| `YOUTUBE_API_KEY` | Live recommendations (cache absorbs repeats) |
| `ABLY_API_KEY` | Live chat push (3s polling stops) |
| `RTK_ACCOUNT_ID`, `RTK_APP_ID`, `RTK_API_TOKEN` | Real video/audio calls |
| `ELEVENLABS_API_KEY` | Voiced narration for explainer videos |
| `STRIPE_*` | Billing + MRR in admin analytics |
| `R2_*` | Cloud video storage (instead of local disk) |
