# apps/api — AI Academy API

NestJS 12 REST API: all business logic for practice, scoring, leaderboards,
groups/chat, AI tutoring, explainer videos, calls, billing, and admin.

- **Runs on:** Node 22 · MongoDB · Redis (optional in dev, required in prod)
- **Read first:** [Architecture](../../docs/ARCHITECTURE.md) · [Operations runbook](../../docs/OPERATIONS.md)

## Quickstart

```bash
docker compose up -d mongo redis          # from the repo root
cp .env.example .env                      # defaults work locally
npm install
npm run seed                              # 54-question starter bank (idempotent)
npm run start:dev                         # watch mode on :4000
```

Health checks: `GET /health` (liveness) · `/health/live` · `/health/ready`
(dependency readiness, 503 when degraded) · `/metrics` (Prometheus).

## Scripts

| Script | Purpose |
|---|---|
| `start:dev` / `start:debug` | Watch mode (debug adds `--inspect`) |
| `build` / `start:prod` | `nest build` / run `dist/main.js` |
| `worker` | Standalone BullMQ worker (all 3 queues) — `dist/worker.js` |
| `seed` | Idempotent question bank seed |
| `promote` | `npm run promote -- <clerk-user-id> admin` |
| `lint` / `typecheck` | oxlint / `tsc --noEmit` |
| `test` / `test:e2e` / `test:cov` | Vitest unit · Supertest e2e (needs Mongo+Redis) · coverage with thresholds |

## Module map

| Module | Responsibility |
|---|---|
| `common` | Guards (auth/throttle/quota), entitlements + durable quota ledger, idempotency, metrics, JSON logging, transactions |
| `users` | Profiles, GDPR export/erasure, roles |
| `questions` / `attempts` / `streaks` | Practice loop: serving, grading, points, streaks |
| `leaderboard` | Redis live board + Mongo snapshots + history |
| `billing` | Stripe Checkout/Portal, idempotent webhooks, reconciliation |
| `llm` | `LlmProvider` (Groq + deterministic stub) |
| `generation` | BullMQ question backfill with quality gates |
| `ai` / `video` | AI tutoring + explainer video pipeline |
| `groups` / `messages` / `realtime` | Social learning & chat |
| `calls` | RealtimeKit rooms, duration caps, per-minute accounting |
| `admin` / `health` / `quota` | Admin surface, health, quota introspection |

## Conventions (summary)

Authenticated by default (`@Public()` to opt out) · DTO validation with
`forbidNonWhitelisted` · atomic quota gates before spend (`consumeOrThrow`) ·
`withTransaction()` for multi-document writes · JSON logs + metrics, never
free-form `console.log` · new env vars go in `.env.example` and are asserted at
boot when production-critical. Full list:
[Development guide → conventions](../../docs/DEVELOPMENT.md#4-codebase-conventions).

## Testing notes

Unit specs are colocated (`*.spec.ts`) and must pass without external services.
`src/common/redis-lua.spec.ts` validates the atomic Lua counter scripts against
a **real** Redis and skips automatically when Redis is unreachable — CI (with
its Redis service container) is what exercises it. See
[Development → testing](../../docs/DEVELOPMENT.md#3-testing).