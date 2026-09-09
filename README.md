# Hoopr — AI/ML Learning Platform (Phase 7 — all spec phases built)

Gamified, social AI/ML practice platform: infinite AI-generated questions,
competitive ranking, streaks, groups, real-time chat, video calls, and on-demand
AI tutoring — monetized via freemium subscriptions.

Spec: single source of truth is the Build Specification v1.0 (Sections 1–8).

## Monorepo

- `apps/web` — Next.js 16 + React 19 + TS + Tailwind. Clerk auth, Sentry stubs,
  landing, `/practice` (question loop + paywall modal), `/leaderboard` (live top-10),
  `/pricing` (Stripe Checkout buttons), `/dashboard` (streak/points/rank/plan cards),
  `/admin` (bank buffer vs target + top-up), `/admin/review` (approve/flag queue),
  `/groups` (list/create/join), `/groups/[id]` (live chat, reactions, challenges, board),
  `/ask` (AI answers + YouTube + history + video requests), `/watch/[jobId]`
  (render progress + mp4 playback + chapters),   `/calls` (active/history/1:1 starter),
  `/calls/[id]` (LiveKit room or setup notice), `/sign-in`, `/sign-up`.
- `apps/mobile` — Expo starter (board + practice fetch, same API contract; `npm run typecheck`).
- `apps/api` — NestJS 12 + TS. Clerk guard with DB role lookup, Redis
  fixed-window entitlements + `QuotaGuard` (429 + `resetAt`), `questions`
  (seed bank + AI backfill, attempt-based dedupe, free hard-teaser gate), `attempts`
  (deterministic grading, points, anti-cheat floor), `streaks` (timezone-aware,
  idempotent), `leaderboard` (Redis ZSET + snapshots), `billing` (Stripe
  Checkout/Portal/idempotent webhooks, graceful 503 without keys),
  `llm` (Anthropic provider w/ dev-stub fallback), `generation` (BullMQ top-up
  jobs, quality gates, Jaccard dedupe, daily budget), `admin` (review queue,
  generation control, role management, message reports), `groups` (tier-capped
  CRUD, expiring invites, member board), `messages` (persist-first chat, reactions,
  read receipts, retention, send throttle), `realtime` (Ably tokens w/ polling fallback),
  `ai` (topic-gated Q&A, canonical answer cache, cached YouTube recs, per-user history),
  `video` (script → ffmpeg slideshow mp4s, tier quotas, monthly spend budget, canonical reuse),
  `calls` (LiveKit rooms, server-side duration caps, per-minute billing, screen-share grants, reports).
- `packages/shared` — roles, quotas, points, grading, streak/leaderboard helpers,
  topics (spec §1, §2.1–2.3, §6).

## Quickstart

1. Prereqs: Node 20+, Docker (for mongo/redis).
2. `docker compose up -d mongo redis`
3. API: `cp apps/api/.env.example apps/api/.env` → defaults work locally →
   `npm install --prefix apps/api && npm run seed --prefix apps/api` (54 questions) →
   `npm run start:dev --prefix apps/api`
4. Web: `cp apps/web/.env.example apps/web/.env.local` → fill Clerk keys →
   `npm install --prefix apps/web && npm run dev --prefix apps/web`
5. Shared: `npm install --prefix packages/shared && npm run build --prefix packages/shared`
6. Health: web http://localhost:3000, api http://localhost:4000/health

## Key endpoints (all verified live)

- `GET /questions/topics|count|next?difficulty&topic` (auth + quota)
- `POST /questions/seed` (idempotent; 409 when seeded)
- `POST /attempts` → `{ isCorrect, pointsAwarded, correctAnswer, explanation, dailyScore, streak }`
- `GET /attempts/me|me/summary` (auth)
- `GET /leaderboard/daily` (public, top-10) · `/leaderboard/top|me` (auth)
- `GET /quota/check?feature=` · `GET /billing/status`
- `POST /billing/checkout|portal` (auth) · `POST /billing/stripe/webhook`
- `GET /admin/generation/status` · `POST /admin/generation/ensure` (admin)
- `GET /admin/review?status=` · `PATCH /admin/review/:id` (admin)
- `POST /groups` · `GET /groups` · `POST /groups/join` · `GET /groups/:id/leaderboard` (auth)
- `POST /groups/:id/messages` · `GET /groups/:id/messages?since=` (auth)
- `POST /realtime/token` → `{mode:"ably",tokenRequest}` or `{mode:"polling"}`
- `POST /ai/ask` (cache-first, quota-checked) · `GET /ai/history|queries/:id` · `GET /ai/stats` (admin)
- `POST /ai/videos` (cached-instant or 202 render job) · `GET /ai/videos|videos/:id` ·
  `GET /ai/videos/file/:id?t=` (signed mp4) · `GET /ai/videos/stats` (admin)
- `POST /calls/start` (1:1 or Pro group) · `POST /calls/:id/join|token|leave|end|report` ·
  `GET /calls` (active + history) · `GET /admin/call-reports` (admin)
- `GET /leaderboard/history|day/:date` (trends) · `GET /attempts/me/analytics` (personal+compare) ·
  `GET /admin/analytics` (platform) · `POST /admin/leaderboard/snapshot` (admin backfill)
- `POST /admin/users/:clerkId/role` · `GET /admin/stats` (admin)

## Phase 2 ops (no Anthropic key needed)

Generation runs on the deterministic dev stub until both `ANTHROPIC_API_KEY`
and `ANTHROPIC_MODEL` are set — the swap is automatic, no code change.

1. Promote yourself: `npm run promote -- <your-clerk-user-id> admin`
   (find the ID in Clerk Dashboard → Users, or sign in and read `/dashboard`).
2. Open `/admin`: bank buffer vs target (default 500/combo), budget, queue depth.
3. "Top up all buffers" (or `POST /admin/generation/ensure` with
   `{topic, difficulty}`) → BullMQ worker generates → quality-gated →
   approved straight to the pool, failures to `/admin/review`.
4. Scale-out: set `GENERATION_WORKER=false` on the API and run
   `npm run build && node dist/worker` (or `npm run worker`) separately.
5. Tunables (`apps/api/.env`): `GENERATION_BUFFER_TARGET/BATCH_SIZE/`
   `CONCURRENCY/DAILY_BUDGET/SIMILARITY_THRESHOLD`.

## Env keys you provide

- Web: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`
- API: `MONGODB_URI` (Atlas in prod), `REDIS_URL` (Upstash/Redis Cloud in prod),
  `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `WEBAPP_URL`
- Phase 2 (leave empty for dev stub): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- Phase 3 (leave empty for 3s polling fallback): `ABLY_API_KEY`
- Phase 4 (leave empty for stub answers + no YouTube): `ANTHROPIC_API_KEY` (pairs with
  `ANTHROPIC_MODEL`), `YOUTUBE_API_KEY`
- Phase 5: local ffmpeg renders work out of the box; `VIDEO_MONTHLY_BUDGET`,
  `VIDEO_COST_USD`, `VIDEO_SECRET` (set in prod); future `ELEVENLABS_API_KEY` (voice),
  `R2_*` (cloud media) auto-upgrade the pipeline when set
- Phase 6 (leave empty for record-only mode): `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET` (LiveKit Cloud free tier) + web `NEXT_PUBLIC_LIVEKIT_URL`
- Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`

## Phase map

- **Phase 0 (done):** auth shell, API skeleton, Mongo+Redis wiring, CI, Sentry stubs.
- **Phase 1 (done):** seed question bank, attempts/points, streak, Redis
  leaderboard, quota middleware enforcement, Stripe Checkout + webhooks.
- **Phase 2 (done):** LLM provider abstraction, BullMQ backfill pipeline,
  automated quality + dedupe gates, daily generation budget, admin review queue.
- **Phase 3 (done):** groups + invites, persist-first chat with Ably live /
  polling fallback, reactions, challenges, group boards.
- **Phase 4 (done):** topic-gated AI Q&A, canonical answer cache (hits are
  quota-free), cached YouTube recommendations, per-user history.
- **Phase 5 (done):** structured explainer pipeline (script → narration pacing →
  local ffmpeg 720p mp4), async jobs with progress, Pro-gated novel renders with
  quota refunds on failure, monthly spend budget, canonical video reuse, signed playback.
- **Phase 6 (done):** LiveKit calls (1:1 free ≤15 min, Pro group + screen share),
  server-side duration caps via scheduled end, per-minute billing, abuse reports.
- **Phase 7 (done here):** nightly snapshots with accuracy, rank history + trends,
  personal/comparative analytics, platform dashboard, global rate limiting,
  cost playbook (`docs/COSTS.md`), Expo mobile starter.
- Deferred deliberately: full i18n (copy is English-only; dates via `Intl`),
  per-topic leaderboard boards (needs per-topic ZSET fan-out at scale).

## Open decisions (spec §8) needed before later phases

Video budget ceiling, structured-vs-generative video, regions/compliance (GDPR/COPPA),
Stripe vs merchant-of-record, call recording, pricing, caps, content scope,
moderation staffing, data export/deletion.
