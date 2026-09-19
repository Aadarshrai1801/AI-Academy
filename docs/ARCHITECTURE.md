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
| `curriculum` | Prerequisite DAG, per-topic mastery gate (`GET /topics/graph`), shared by questions/attempts |
| `mastery` | Per-topic mastery scores + decay, onboarding placement quiz, `GET /users/me/mastery` |
| `streaks` | Timezone-aware, idempotent daily streaks |
| `leaderboard` | Redis ZSET live board + nightly Mongo snapshots + history |
| `billing` | Stripe Checkout/Portal, signature-verified webhooks with a persisted idempotency ledger, subscription↔role sync, reconciliation |
| `llm` | `LlmProvider` interface: Groq (OpenAI-compatible, model rotation) + deterministic dev stub |
| `generation` | BullMQ question backfill: quality gates, Jaccard dedupe, daily budget |
| `ai` | Topic-gated Q&A, canonical answer cache, mistake-diagnosis cache, YouTube recommendations, history |
| `video` | Script → ffmpeg 720p mp4 pipeline, topic playlists (3-5/topic) with end-of-playlist checks, monthly spend budget, canonical reuse, HMAC-signed playback |
| `groups` / `messages` | Social learning: tier-capped groups, expiring invites, persist-first chat, reactions, reports, retention policy |
| `realtime` | Ably token issuance with 3s-polling fallback |
| `calls` | RealtimeKit (RTK) rooms, server-side duration caps, per-minute accounting, abuse reports |
| `admin` | Review queue, generation control, role management, analytics, audit trail |
| `common` | Guards, entitlements + durable quota ledger, throttle, idempotency, metrics, JSON logging, transactions |

### 3.1 Learning path (`curriculum`)

The curriculum is a prerequisite DAG over the six topics (foundations
`ml-basics` and `statistics`; then `neural-networks`/`evaluation`, then
`deep-learning`, then `llms`). The canonical copy lives in
`packages/shared` (`TOPIC_GRAPH`); the API keeps an identical local copy in
`src/curriculum/curriculum.ts` (no cross-workspace runtime imports), and
contract tests in both places assert the graph is acyclic, references only
known topics, and stays topologically sorted.

- **Gate rule:** a topic unlocks when every prerequisite reaches
  `TOPIC_GATE_CONSECUTIVE_CORRECT` (default 3) consecutive correct attempts.
  Only first attempts of the day count — `attempts.is_retry` (reveal-assisted
  same-day retries) and `attempts.hint_used` rows break the run. Attempt rows
  written before this feature are treated as non-retry / hint-free.
- **Enforcement points:** `QuestionsService.next()` excludes locked topics from
  random serving and 403s (`feature: 'topic_locked'` + prerequisite detail)
  when a locked topic is requested; `QuestionsService.byId()` and
  `AttemptsService.submit()` gate deep links and direct submissions.
  Admins bypass the gate; `TOPIC_GATE_ENABLED=false` disables it globally.
- **Read model:** `GET /topics/graph` (authenticated, no quota) returns the
  DAG nodes with the caller's status (`locked`/`unlocked`/`in_progress`/
  `mastered`), consecutive-correct progress, and approved question counts per
  difficulty — everything the web skill tree needs. Gate state is derived
  from the last ≤3 attempts per topic on each request; there is no separate
  gate collection (the additive mastery score in §3.2 is a different
  concept).

### 3.2 Adaptive mastery (`mastery`)

A separate, per-user × per-topic score (0–100) that measures how well a
learner knows each topic; it never affects scoring, and the prerequisite gate
keeps its own consecutive-correct rule.

- **Update model:** per graded attempt EMA with `MASTERY_EMA_ALPHA` (default
  0.2) and a difficulty multiplier (easy 0.7×, medium 1×, hard 1.3×). Hints
  halve gains and deepen misses (1.25×), and reveal-assisted retries are
  ignored. First correct attempt on a topic seeds the score at
  `α × 100 × difficulty`.
- **Decay:** reads apply exponential decay from `updated_at` with
  `MASTERY_DECAY_HALF_LIFE_DAYS` (default 30) — no background job; the stored
  score stays authoritative and decay is presentation only.
- **Placement diagnostic:** `GET /mastery/diagnostic` samples 8 questions
  (two foundation topics easy+medium, one easy for each other topic) and stores
  the id set on the user document; `POST /mastery/diagnostic` grades them and
  seeds topics that have no record yet (`source: 'diagnostic'`), then marks
  `onboarding_diagnostic_completed_at` (one-shot: re-submits get 409). Serving
  and grading are free — no quota. The web `/progress` route shows the CTA and
  runs the quiz.
- **Endpoints:** `GET /users/me/mastery` (learner dashboard; authenticated,
  free) returns per-topic score/attempts/accuracy/source plus
  `recommendedDifficulty` bands (`<40` easy, `40–69` medium, `≥70` hard) and
  `diagnosticCompleted`. Distinct from the admin-only analytics.
- **Serving integration (adaptive difficulty):** `GET /questions/next` with no
  explicit difficulty asks `recommendedByTopic()` and aims each unlocked topic
  at its mastery band (default `easy` when the topic has no history). Free
  tier is capped at medium so the explicit hard-teaser gate keeps its meaning;
  explicit filters and admins bypass adaptation; the response carries
  `adaptive: true` when a band was applied, and a thin (topic × difficulty)
  bank cell falls back to any difficulty instead of 404ing.
- **Data rights:** `topic_mastery` is included in the GDPR export and erased
  with the account (`users` module owns the cascade).

### 3.3 AI tutoring: explain my mistake

When a practice answer is wrong, the web app deep-links
`/ask?prompt=…&questionId=…&userAnswer=…&correctAnswer=…`; the composer
prefills and the request carries the structured fields. The same
`POST /ai/ask` endpoint routes to the mistake flow when `userAnswer` +
`correctAnswer` are present.

- **Separate cache:** `mistake_cache` is keyed exactly on the normalized
  (question, wrong answer) pair — a different wrong answer is a different
  misconception worth its own explanation. It is intentionally NOT the
  `canonical` collection, so Q&A hit-rate (`GET /ai/stats`) and mistake
  hit-rate are reported separately (`stats.mistakeCache`).
- **Cost control unchanged:** cache hits are free; misses consume one
  `ai_text` unit with the same refund-on-failure rules as free-form asks.
  The deterministic stub provider answers mistake queries too, so the flow
  works without `GROQ_API_KEY`.
- **Prompt shape:** the provider receives question + wrong answer + correct
  answer (+ the bank explanation as grounding) and must name the
  misconception, not restate the generic answer.

### 3.4 Explainer video playlists

Video jobs gain optional `topic_id` + `sequence_index` (0–4) so topic
requests form a 3–5 video playlist instead of one-off explainers.

- `POST /ai/videos` accepts an optional `topicId`: a new render takes the next
  free slot; when the playlist is full the video stays standalone. Canonical
  reuse can tag an untagged ready video into a playlist once (best-effort).
- `GET /ai/videos/sequence/:topicId` returns the topic's ready videos ordered
  by slot; `GET /ai/videos/sequence/:topicId/check` returns 1–2 approved,
  non-hard questions from the topic via the questions module (serving is
  free — the hard-teaser gate is never bypassed).
- The web watch page shows the playlist strip and, after the last video in
  the sequence, a check-for-understanding card linking to each question.
- **Cost control is untouched:** these fields/render paths still consume
  `ai_video` quota and count against `VIDEO_MONTHLY_BUDGET`; canonical reuse
  remains instant and free.

### 3.6 Free-tier access to cached content

Audit rule (Phase 12): entitlements gate **fresh work** (LLM calls, novel
renders, live call minutes, first graded practice attempt), never **cached
artifacts**. Concretely:

- canonical/mistake cache hits in the `ai` module return before any
  `consumeOrThrow` — free at every tier;
- `GET /ai/videos/:id` now serves any `ready` job to any authenticated user
  (canonical-reuse playback), while queued/generating/failed jobs stay
  owner-only; novel renders and their spend budget are unchanged;
- question serving never consumes quota — the practice unit is spent on the
  first graded attempt per question per day;
- the hard-difficulty teaser (2/day free) and novel-render/video limits are
  deliberate product gates, not cache restrictions.

## 4. Data stores

**MongoDB** (source of truth): `users`, `attempts`, `streaks`, `questions`,
`leaderboard_snapshots`, `subscriptions`, `stripe_events`, `groups`,
`messages`, `ai_queries`, `canonical` (answer cache), `mistake_cache`
(misconception explanations), `video_jobs`, `topic_mastery` (adaptive mastery),
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