# Operations runbook

Practical runbook for running AI Academy in a shared/production environment.
Anything marked **[operator]** depends on accounts, providers, or legal
decisions that live outside the repo.

## Configuration and boot safety

- `NODE_ENV=production` enables strict validation at boot (`apps/api/src/config.ts`).
  The API refuses to start without:
  `MONGODB_URI`, `CLERK_SECRET_KEY`, `REDIS_URL`, `VIDEO_SECRET`,
  `CORS_ORIGINS` (or `WEBAPP_URL`), and — when `STRIPE_SECRET_KEY` is set —
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
  Partial `R2_*` configuration also fails boot.
- Local/dev behaviour is unchanged: no Clerk key = warning + `dev-user` bypass;
  no Redis = quotas allow (dev only). Both are impossible in production.
- The web app validates `NEXT_PUBLIC_API_URL` / Clerk keys at server start
  (`apps/web/src/instrumentation.ts`) and refuses to serve in production when
  they are missing or malformed.

## Health, logs, and errors

- `GET /health` and `GET /health/live` — liveness (no dependencies). Used by the
  keep-alive workflow and Docker `HEALTHCHECK`.
- `GET /health/ready` — Mongo + Redis ping; returns 503 with per-dependency
  detail when not ready. Point load balancers at this, not `/health`.
- Every response carries `x-request-id` (inbound value reused). 5xx responses
  include `requestId` and `path`; the same id is attached to Sentry events.
- Errors are serialized by `AllExceptionsFilter` as
  `{ statusCode, error, ...featureFields, requestId, path }` — 5xx never leak
  internal messages.
- **[operator]** Sentry: set `SENTRY_DSN` (API) and
  `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_ORG`/`SENTRY_PROJECT` (web) to turn on
  error reporting. Set `SENTRY_TRACES_SAMPLE_RATE` if 0.1 tracing is too hot.

## Queues and workers

- Three BullMQ queues: `question-gen`, `video-render`, `call-timers`.
- Default: the API process hosts all workers. To scale independently, set
  `GENERATION_WORKER=false`, `VIDEO_WORKER=false`, `CALL_WORKER=false` on the
  API and run `node dist/worker.js` (all queues) in a separate service — the
  Docker image includes ffmpeg for video.
- Generation top-ups use deterministic job ids, so pressing "top up" twice does
  not duplicate work. `POST /admin/generation/clean-failed` clears the failed
  pile; `/admin/generation/drain-waiting` cancels pending batches.
- Call timers are BullMQ delayed jobs; losing Redis means active calls will not
  auto-end at the cap. Redis persistence (AOF) is required in production.

## Rate limiting and quotas

- Global fixed window: `RATE_LIMIT_PER_MIN` (default 120/min per user/IP),
  Redis-backed. 429s carry `Retry-After` and `X-RateLimit-*` headers.
  Counter increments are atomic Lua scripts (INCR + EXPIRE + rollback on
  over-limit), so a crash can never leave a TTL-less key that permanently
  blocks a user, and an over-limit request never consumes quota.
- `TRUST_PROXY` (default 1) controls how many proxy hops the API trusts for
  `X-Forwarded-For` → `req.ip`. Behind CDN + load balancer set it to 2, or all
  clients share one IP bucket.
- Feature quotas live in Redis (`EntitlementsService`); if Redis is down in
  production, gated endpoints return 503 instead of granting unlimited usage.
  Set `QUOTA_FAIL_OPEN=true` only if availability is more important than the
  quota guarantee (dev only).
- Idempotency: POSTs to `/attempts`, `/billing/checkout`, `/billing/portal`,
  `/ai`, and `/ai/videos` honor an `Idempotency-Key` header (the web client
  already sends one). Completed responses are cached 24h and replayed with an
  `Idempotency-Replayed: true` header; concurrent duplicates get 409 while the
  first request is in flight.
- Stripe webhook safety net: events missing `metadata.userId` are resolved via
  the Stripe customer/subscription ids stored on the subscription row; if even
  that fails, the miss is logged (never silently ignored). `POST
  /admin/billing/reconcile` (admin-only, audited) walks every Stripe
  subscription and repairs desynced subscription/role rows.
- `/admin/generation/status` shows the daily generation budget; `/ai/stats`
  and `/ai/videos/stats` show LLM/video spend (see `docs/COSTS.md`).

## Metrics, alerting, and logs

- `GET /metrics` serves Prometheus text format (scrape every 15–30s):
  - RED: `http_requests_total{method,route,status}`,
    `http_request_duration_seconds` (histogram, p99 via `histogram_quantile`).
  - Process: uptime, RSS, heap, `nodejs_eventloop_lag_p99_seconds`.
  - Business: `api_quota_denied_total{feature}`, `api_redis_failures_total{component}`,
    `api_jobs_failed_total{queue}`.
  - Set `METRICS_TOKEN` to require a bearer token on scrapes.
  - Route labels are id-normalized (`/ai/videos/<oid>` → `/ai/videos/:id`) to
    bound cardinality; the registry caps series at 1000.
- Suggested alert rules (PromQL):
  - `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.02` — 5xx rate.
  - `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2` — p99 latency.
  - `increase(api_redis_failures_total[5m]) > 0` — Redis degradation (in
    multi-instance deployments this multiplies effective rate limits — page it).
  - `increase(api_jobs_failed_total[10m]) > 0` — background job failures.
- **Logs are structured JSON lines on stdout** (`msg`, `severity`, `method`,
  `path`, `status`, `ms`, `requestId`, `user`, `ip`) — ingest directly; no
  regex parsing needed. Querystrings are stripped (never log tokens).
- **DLQ policy**: BullMQ's retained failed set is the dead-letter queue.
  `api_jobs_failed_total` fires the alert; after a fix, drain with
  `POST /admin/generation/clean-failed`. Don't clean before diagnosing — the
  pile is the incident record.

## GDPR: access and erasure

Public-facing documents: `PRIVACY.md`, `TERMS.md`, `SECURITY.md`,
`docs/COMPLIANCE.md` (data map, retention, subprocessors, DSAR procedure).
Users can also self-serve from the dashboard ("Data & privacy"): download a
JSON export and erase the account.

- Export: `GET /users/me/export` returns every app-side record for the caller
  (capped at 10k rows per collection, with `truncated` flags).
- Erasure: `DELETE /users/me?confirm=DELETE`
  - deletes user, subscription, attempts, streaks, AI queries, video jobs,
    owned groups and their messages, messages authored by the user;
  - removes the user from other groups/membership counts, call participant
    lists, message read receipts and chat reactions, nulls 1:1 invitee
    references, scrubs live Redis leaderboards and historical ranking snapshots;
  - deletes local video files from disk and rendered objects from R2.
- **[operator]** Follow-ups that require external systems:
  - enable GitHub private vulnerability reporting (referenced by `SECURITY.md`);
  - delete the Clerk user (Dashboard or a `user.deleted` webhook handler);
  - confirm the retention/legal basis for Stripe invoices (Stripe is the
    merchant record of truth);
  - fill in the bracketed placeholders and have counsel review the legal
    documents (checklist in `docs/COMPLIANCE.md` §10).
- **[operator]** Write the customer-facing retention schedule and DPA/subprocessor
  list (Clerk, Stripe, MongoDB Atlas, Redis, R2/Cloudflare, Ably, Sentry, LLM
  provider), and decide the COPPA/age-gate policy.

## Admin audit trail

- Every admin mutation (role change, review decision, generation control,
  snapshot backfill) writes an append-only row to `audit_events` with actor,
  action, target, IP, and timestamp.
- View via `GET /admin/audit?limit=` or the database. There are no update/delete
  endpoints; retain at the database level per your policy.

## Deploys

- API: `docker build -t ai-academy-api ./apps/api` then run with the prod
  environment (the image runs `dist/main.js` as the non-root `node` user and
  has a `HEALTHCHECK`). Worker: same image, command `node dist/worker.js`.
- Web: deploy `apps/web` to your Next host (Vercel/Render); CI gates
  lint + typecheck + build.
- **[operator]** Add provider-level controls: Atlas network allow-list and PITR,
  Upstash persistence, R2 lifecycle rules, GitHub environment protection, and
  required status checks / branch protection for `main`.

## Metered Redis (Upstash) and BullMQ command budgets

BullMQ keeps polling Redis even when idle (stalled checks, blocking pops,
heartbeats) and the API adds a command per quota/rate-limit/leaderboard call.
On Upstash's per-command free tier (500k requests/month) a single API process
can exhaust the quota, after which **every** Redis command fails — quota checks
fall back to fail-closed (503), the leaderboard degrades, and the workers log
`ERR max requests limit exceeded` until the cycle resets.

Built-in mitigations:

- `src/common/bull-connection.ts` rate-limits reconnect/error logging to one
  line per minute per queue, so an outage cannot flood runtime logs.
- The same module raises `stalledInterval` (30s → 120s) and `drainDelay`
  (5s → 30s), cutting idle BullMQ traffic. Restore BullMQ defaults with
  `REDIS_COMMAND_BUDGET_GUARD=false`, or tune per deployment with
  `REDIS_STALLED_INTERVAL_MS` / `REDIS_DRAIN_DELAY_S`.

For production with a metered provider, prefer one of:

- **Flat-rate Redis** (Render Key Value, Railway, Fly, ElastiCache) — the
  intended pairing for BullMQ-style polling queues.
- **Disable workers on the API and run a separate worker process**:
  set `GENERATION_WORKER=false`, `VIDEO_WORKER=false`, `CALL_WORKER=false` on
  the web-facing service and deploy `npm run worker` (all three queues) as its
  own instance — connects once instead of three queues per replica.
- If keeping Upstash: upgrade past the free tier and set a budget alert at
  80% of the request allowance.

## Backups and disaster recovery

- **[operator]** Not yet codified in the repo. Minimum before public launch:
  - Atlas: enable continuous backups/PITR; document RPO/RTO.
  - Redis: confirm persistence; leaderboards are rebuildable from attempts, but
    call timers and quotas are not.
  - R2: enable object versioning/lifecycle; videos are regenerable at cost.
  - Rehearse a restore (`mongorestore` into a scratch cluster) and record the
    runbook here with the tested date.

## Secrets and rotations

- `scripts/check-secrets.mjs` runs in CI on every push/PR and fails on
  high-signal credential patterns (Stripe/AWS/GitHub/Google/LLM keys, private
  keys). Run `npm run check:secrets` locally and
  `npm run check:secrets:history` after cloning to scan every commit.
- Generate `VIDEO_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Rotating it invalidates outstanding signed playback URLs (10-minute TTL) —
  safe to rotate at any time; users just re-request the stream URL.
- Never commit `.env*` (only `.env.example` templates are tracked). If a
  credential ever lands in git, rotate it first, then purge history.
- **[operator]** Stripe/CLERK/R2 keys and `VIDEO_SECRET` for production: set
  them in the host dashboard (or a secrets manager), keep
  `ALLOW_DEV_AUTH_BYPASS` / `QUOTA_FAIL_OPEN` unset there, and rotate on
  schedule and after any suspected leak. Enable GitHub secret scanning + push
  protection.
