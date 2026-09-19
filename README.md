# AI Academy (Hoopr)

Gamified, social AI/ML practice platform: infinite AI-generated questions,
competitive daily ranking, streaks, groups with live chat, video calls, and
on-demand AI tutoring with auto-generated explainer videos — monetized via
freemium (Stripe) subscriptions.

| | |
|---|---|
| **Stack** | NestJS 12 API · MongoDB · Redis · Next.js web · Expo mobile |
| **Auth** | Clerk (deny-by-default, server-side roles) |
| **Payments** | Stripe Checkout + Portal + idempotent webhooks |
| **AI** | Groq (OpenAI-compatible) question generation & tutoring |
| **Node** | 22 (see `.nvmrc`) · **License:** proprietary (see `LICENSE`) |

## Architecture at a glance

```
  Next.js web (3000)      Expo mobile          ┌─ BullMQ workers ─┐
        │  Bearer token        │                  │ question-gen     │
        ▼                      ▼                  │ video-render     │
  ┌─────────────────────────────────────┐         │ call-timers      │
  │           NestJS API (4000)         │◄────────┴──────────────────┘
  │  Clerk guard → throttle → quota     │
  │  controllers → services             │
  └───────┬──────────────┬──────────┬───┘
          ▼              ▼          ▼
     MongoDB          Redis      Groq / Stripe / Ably / R2 / RealtimeKit
   (source of      (quotas,     (LLM, payments, realtime, media, calls)
    truth)         counters)
```

| Path | What it is |
|---|---|
| `apps/api` | NestJS 12 REST API — all business logic, 18 feature modules |
| `apps/web` | Next.js web app (practice, leaderboard, groups, AI, admin) |
| `apps/mobile` | Expo starter mirroring the practice loop (typecheck-only for now) |
| `packages/shared` | Shared contracts: roles, quotas, points, grading, topics |
| `docs/` | Architecture, runbook, costs, compliance, contributor guide |

## Quickstart

**Prereqs:** Node 22+ · Docker (for local Mongo + Redis).

```bash
# 1. Infrastructure
docker compose up -d mongo redis

# 2. API
cp apps/api/.env.example apps/api/.env          # defaults work locally
npm install --prefix apps/api
npm run seed --prefix apps/api                   # 54-question starter bank
npm run dev:api                                  # http://localhost:4000

# 3. Shared package (contract types used by tests)
npm install --prefix packages/shared && npm run build:shared

# 4. Web
cp apps/web/.env.example apps/web/.env.local     # fill Clerk keys
npm install --prefix apps/web
npm run dev:web                                  # http://localhost:3000
```

Verify: `GET http://localhost:4000/health` → `{"status":"ok",...}`.
Optionally run the API itself in Docker (image includes ffmpeg):
`docker compose --profile app up -d --build`.

> Local dev is intentionally forgiving: no Clerk key = dev-user bypass, no
> Redis = quotas allow. **Production refuses to boot** misconfigured — see
> [Operations → Boot safety](docs/OPERATIONS.md).

## Documentation

Start with the [documentation index](docs/INDEX.md). Reading paths by role:

| I want to… | Read |
|---|---|
| Understand how the system works | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Contribute code / open a PR | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |
| Run it in production | [`docs/OPERATIONS.md`](docs/OPERATIONS.md) |
| Control AI/infra spend | [`docs/COSTS.md`](docs/COSTS.md) |
| Handle data protection / GDPR | [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) |
| Report a security issue | [`SECURITY.md`](SECURITY.md) |

## Feature map

All spec phases are built. Feature areas and where they live:

| Area | What it does | API module | Web route |
|---|---|---|---|
| Practice loop | AI-generated questions, deterministic grading, points, anti-cheat | `questions`, `attempts` | `/practice` |
| Learning path | Prerequisite DAG gating, placement diagnostic, per-topic mastery + recommended difficulty | `curriculum`, `mastery` | `/progress` |
| Streaks | Timezone-aware, idempotent daily streaks | `streaks` | `/dashboard` |
| Leaderboard | Live Redis ZSET board + nightly Mongo snapshots, history & trends | `leaderboard` | `/leaderboard` |
| AI tutoring | Topic-gated Q&A with canonical answer cache, mistake diagnosis cache, YouTube recs | `ai` | `/ask` |
| Explainer videos | Script → ffmpeg 720p mp4, spend budget, canonical reuse, topic playlists + checks, signed playback | `video` | `/watch/[jobId]` |
| Question pipeline | BullMQ backfill, quality gates, Jaccard dedupe, daily budget, human review | `generation`, `admin` | `/admin`, `/admin/review` |
| Groups & chat | Tier-capped groups, expiring invites, persist-first chat, reactions, study/competitive modes with missed-question feed | `groups`, `messages`, `realtime` | `/groups/[id]` |
| Video calls | RealtimeKit rooms, server-side duration caps, per-minute billing, reports | `calls` | `/calls/[id]` |
| Billing | Stripe Checkout/Portal, persisted idempotent webhooks, entitlements | `billing` | `/pricing` |
| Trust & safety | Deny-by-default auth, RBAC, admin audit trail, GDPR export/erasure | `admin`, `users` | `/admin`, dashboard |

## Environment variables

Every variable is documented inline in `apps/api/.env.example` and
`apps/web/.env.example`. The short version:

- **Required in production** (API refuses to boot otherwise): `MONGODB_URI`,
  `CLERK_SECRET_KEY`, `REDIS_URL`, `VIDEO_SECRET`, `CORS_ORIGINS` (or
  `WEBAPP_URL`), plus `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` when Stripe is
  configured.
- **Optional, graceful degradation**: `GROQ_API_KEY`/`GROQ_MODEL` (real AI),
  `ABLY_API_KEY` (live chat vs polling), `YOUTUBE_API_KEY`,
  `ELEVENLABS_API_KEY` (voiced videos), `R2_*` (cloud media), `RTK_*` (calls),
  `SENTRY_DSN`, `STRIPE_*` (billing).
- **Dev-only escapes** (ignored in production): `ALLOW_DEV_AUTH_BYPASS`,
  `QUOTA_FAIL_OPEN`.

## Admin & operations quick reference

```bash
npm run promote --prefix apps/api -- <clerk-user-id> admin   # promote yourself
npm run seed --prefix apps/api                               # idempotent seed
npm run worker --prefix apps/api                             # standalone worker (all queues)
```

Then open `/admin` (bank buffers, top-ups, review queue) — details in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Status & known gaps

- **Done:** all 7 spec phases plus hardening (fail-closed boot config,
  transactional scoring, webhook idempotency, Prometheus metrics, JSON logs,
  idempotency keys, audit trail, GDPR self-service, CI quality gates).
- **Deferred deliberately:** full i18n (English-only copy), per-topic
  leaderboard boards, mobile app beyond the starter shell.
- **Legal drafts need operator fill-in:** bracketed placeholders across
  `LICENSE`, `SECURITY.md`, `PRIVACY.md`, `TERMS.md` — checklist in
  [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) §10.

