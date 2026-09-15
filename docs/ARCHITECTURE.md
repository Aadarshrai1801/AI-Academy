# Architecture

How AI Academy is designed. For how to run it, see the
[runbook](OPERATIONS.md); for how to contribute, see the
[development guide](DEVELOPMENT.md).

## 1. System overview

```
  ┌─────────────┐   ┌─────────────┐        ┌──────────────────────────────┐
  │ Next.js web │   │ Expo mobile │  HTTPS │        NestJS API            │
  │  (Vercel)   │   │  (starter)  │───────►│  middleware chain:           │
  └─────────────┘   └─────────────┘        │  request-id → http-log →     │
                                           │  idempotency → Clerk guard → │
                                           │  throttle → quota guard      │
                                           └───┬──────────┬──────────┬────┘
                                               │          │          │
                                        ┌──────▼───┐ ┌────▼───┐ ┌────▼─────────┐
                                        │  MongoDB │ │ Redis  │ │ 3rd parties  │
                                        │ (source  │ │counters│ │ Groq · Stripe│
                                        │ of truth)│ │+ queues│ │ Ably · R2 ·  │
                                        └──────┬───┘ └────┬───┘ │ RTK · YouTube│
                                               │          │     └──────────────┘
                                        ┌──────▼──────────▼────┐
                                        │  BullMQ workers      │
                                        │  (in-process or the  │
                                        │   standalone worker) │
                                        └──────────────────────┘
```

**Design principles**

1. **Mongo is the source of truth.** Redis holds derived/volatile state
   (counters, live boards, queue jobs); everything durable is written to Mongo.
2. **Fail closed in production, fail open in development.** Misconfiguration
   stops the boot; Redis outages deny quotas (503) in prod and allow in dev.
3. **Money paths are atomic.** Quota gates, rate-limit counters, and billing
   state changes are single atomic operations (Lua scripts / Mongo
   transactions) — never check-then-act.
4. **Degrade, never lie.** Every optional provider (LLM, chat, calls, YouTube,
   TTS) has a documented stub/degraded mode so missing keys never corrupt data.

## 2. API request lifecycle

Every request flows through the same middleware + guard chain:

| Order | Layer | File | Responsibility |
|---|---|---|---|
| 1 | request-id middleware | `common/request-id.middleware.ts` | Assign/propagate `x-request-id` |
| 2 | HTTP logger | `common/http-logger.middleware.ts` | JSON access log + Prometheus metrics |
| 3 | Idempotency | `common/idempotency.middleware.ts` | Replays cached responses for repeated `Idempotency-Key` POSTs |
| 4 | Clerk guard (global) | `common/clerk-auth.guard.ts` | Verify session token, resolve role from DB — **deny by default**; routes opt out via `@Public()` |
| 5 | Throttle guard (global) | `common/throttle.guard.ts` | 120 req/min per user/IP (Redis, Lua-atomic) |
| 6 | Quota guard (per-route) | `common/quota.guard.ts` | Feature entitlement check → 429 + `resetAt` |
| 7 | Controller → service | `src/<module>/` | DTO validation (`class-validator`, forbid unknown fields), business logic |

**Error contract:** one exit point (`common/all-exceptions.filter.ts`) —
`{ statusCode, error, ...featureFields, requestId, path }`. 5xx never leak
internal messages; 5xx are logged as structured JSON and reported to Sentry.

**Money-path gating:** services call `EntitlementsService.consumeOrThrow()`
(atomically consume-or-429) *immediately before* spending budget (LLM call,
render job), and `refund()` on failure paths. The guard's check is advisory
UX; the atomic consume is authoritative.

## 3. Modules (apps/api)

| Module | Responsibility |
|---|---|
| `users` | Profiles, GDPR export/erasure, role storage |
| `questions` | Question bank, serving (dedupe + hard-teaser gate), quota consumption |
| `attempts` | Deterministic grading, points (speed multiplier), transactional scoring path |
| `streaks` | Timezone-aware, idempotent daily streaks |
| `leaderboard` | Redis ZSET live board + nightly Mongo snapshots + history |
| `billing` | Stripe Checkout/Portal, signature-verified webhooks with a persisted idempotency ledger, subscription↔role sync, reconciliation |
| `llm` | `LlmProvider` interface: Groq (OpenAI-compatible, model rotation) + deterministic dev stub |
| `generation` | BullMQ question backfill: quality gates, Jaccard dedupe, daily budget |
| `ai` | Topic-gated Q&A, canonical answer cache, YouTube recommendations, history |
| `video` | Script → ffmpeg 720p mp4 pipeline, monthly spend budget, canonical reuse, HMAC-signed playback |
| `groups` / `messages` | Social learning: tier-capped groups, expiring invites, persist-first chat, reactions, reports, retention policy |
| `realtime` | Ably token issuance with 3s-polling fallback |
| `calls` | RealtimeKit (RTK) rooms, server-side duration caps, per-minute accounting, abuse reports |
| `admin` | Review queue, generation control, role management, analytics, audit trail |
| `common` | Guards, entitlements + durable quota ledger, throttle, idempotency, metrics, JSON logging, transactions |

## 4. Data stores

**MongoDB** (source of truth): `users`, `attempts`, `streaks`, `questions`,
`leaderboard_snapshots`, `subscriptions`, `stripe_events`, `groups`,
`messages`, `ai_queries`, `canonical` (answer cache), `video_jobs`,
`quota_usage` (durable quota ledger), `audit_events` (append-only).

**Redis** (volatile/derived — every key has a TTL):

| Pattern | Purpose | TTL |
|---|---|---|
| `rl:<window>:<user\|ip>` | Rate-limit fixed window | 60 s |
| `quota:<user>:<period>:<feature>` | Quota counters | 1 d / 31 d |
| `lb:daily:<day>` + `lb:names:<day>` | Live leaderboard ZSET | 3 d |
| `video:budget:<yyyymm>` | Monthly render spend budget | ~1 mo |
| `idem:<key>` (+ `:lock`) | Idempotency-Key response cache | 24 h |
| BullMQ internals | Queues: `question-gen`, `video-render`, `call-timers` | per job |

**Object storage:** local disk or Cloudflare R2 for rendered mp4s (playback
via HMAC-signed, 10-minute URLs — `VIDEO_SECRET`).

## 5. Async pipeline

Three BullMQ queues, hosted in-process by default or by the standalone worker
(`npm run worker`):

- **`question-gen`** — LLM question generation with quality gates + dedupe;
  deterministic job ids make top-ups idempotent; `attempts: 8`; the retained
  failed set is the DLQ.
- **`video-render`** — script → TTS (optional ElevenLabs) → ffmpeg slideshow;
  quota refunded on failure; `attempts: 1` (canonical reuse makes retries cheap).
- **`call-timers`** — delayed jobs that hard-end calls at the duration cap.

## 6. Resilience & degradation matrix

| Dependency down | Behavior |
|---|---|
| Redis (prod) | Quotas → **503 fail-closed**; rate-limit falls back to per-instance counters (alert on `api_redis_failures_total`); leaderboard degrades to in-memory; queues stop (call caps unenforced — use Redis with persistence) |
| Redis (dev) | Everything degrades gracefully; local dev stays unblocked |
| Groq/LLM | Deterministic stub provider (no key), retries w/ model rotation + backoff on 429/5xx |
| Mongo | Role lookup fails closed to `free` (throttled warning); transactions fall back to sequential writes on standalone instances |
| Ably | Clients fall back to 3s polling |
| YouTube / ElevenLabs / R2 | Cached, stubbed, or local-disk fallbacks |
| Stripe unconfigured | Billing endpoints return a clear 503; everything else works |

## 7. Security model

- **AuthN:** Clerk session tokens verified per request; no session cookie
  trust; dev-only bypass is impossible in production (boot assertion).
- **AuthZ:** roles (`free`/`pro`/`admin`) resolved from the DB per request,
  never from client claims; admin routes double-guarded (`AdminGuard`).
- **Payments:** Stripe webhook signature verification + persisted event
  ledger (idempotent, replay-safe); subscription/role updates commit in one
  Mongo transaction; customer-id fallback + admin reconciliation for
  metadata-less events.
- **Abuse:** global throttle + per-feature quotas with atomic rollback
  (denied requests never consume quota); impossibly-fast attempt submissions
  rejected (anti-cheat floor).
- **Media:** signed playback URLs (HMAC-SHA256, timing-safe compare, 10-min TTL).
- **Data rights:** self-service JSON export + full erasure (DB, Redis, disk, R2).

See [Operations](OPERATIONS.md) for runbook details and
[Compliance](COMPLIANCE.md) for the data map.