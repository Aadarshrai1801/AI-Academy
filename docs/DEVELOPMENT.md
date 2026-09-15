# Development guide

Everything you need to contribute code. For how the system works, see
[Architecture](ARCHITECTURE.md); for running production, see the
[runbook](OPERATIONS.md).

## 1. Setup

**Prereqs:** Node 22+ (`.nvmrc`), Docker, npm ≥ 10.

```bash
git clone https://github.com/Aadarshrai1801/Hoopr.git && cd Hoopr

# Infrastructure (local Mongo + Redis)
docker compose up -d mongo redis

# API
cp apps/api/.env.example apps/api/.env   # defaults work out of the box
npm install --prefix apps/api
npm run seed:api                         # 54-question starter bank (idempotent)

# Shared package (contract types)
npm install --prefix packages/shared && npm run build:shared

# Web
cp apps/web/.env.example apps/web/.env.local   # add Clerk keys (free tier)
npm install --prefix apps/web

# Mobile (optional — typecheck only for now)
npm install --prefix apps/mobile
```

Start everything:

```bash
npm run dev:api     # NestJS watch mode on :4000
npm run dev:web     # Next.js dev server on :3000
```

### Make yourself an admin

```bash
npm run promote --prefix apps/api -- <clerk-user-id> admin
```

Find the user id in Clerk Dashboard → Users, or sign in and read
`/dashboard`. Then open `/admin`.

### Useful flags in `apps/api/.env`

| Flag | Effect |
|---|---|
| `ALLOW_DEV_AUTH_BYPASS=true` | Dev-user auth passthrough without Clerk keys (prod-impossible) |
| `QUOTA_FAIL_OPEN=false` | Quotas deny instead of allow when Redis is missing locally |
| `GROQ_API_KEY` + `GROQ_MODEL` | Swap the deterministic question/answer stub for a real LLM — no code change |

## 2. Scripts

Root (`package.json`) — run from the repo root:

| Script | Does |
|---|---|
| `dev:api` / `dev:web` / `dev:mobile` | Watch-mode dev servers |
| `lint:*`, `typecheck:*` | Per-package lint (oxlint / eslint) and `tsc --noEmit` |
| `test:api`, `test:e2e:api`, `test:shared` | Test suites |
| `seed:api`, `promote`, `worker:api` | Seed bank, promote role, standalone worker |
| `check:secrets` (`:history`) | Credential scan of tracked files (or full git history) |

API (`apps/api`) scripts: `test` (vitest unit), `test:e2e` (HTTP-level, needs
Mongo+Redis), `test:cov` (coverage with enforced thresholds), `build`
(`nest build`), `start:prod`, `worker`.

## 3. Testing

| Kind | Command | Needs | Notes |
|---|---|---|---|
| Unit | `npm run test:api` | nothing | Pure-logic specs next to the code (`*.spec.ts`); fakes model Redis/Mongo semantics |
| Redis integration | `src/common/redis-lua.spec.ts` | Redis on `localhost:6379` | Validates the atomic Lua scripts for real; **skips automatically** when Redis is unreachable |
| E2E | `npm run test:e2e:api` | Mongo + Redis | HTTP-level via Supertest |
| Contract | `npm run test:shared` | nothing | Shared package behavior |
| Coverage | `npm run test --prefix apps/api -- --run --coverage` | — | Thresholds enforced in `vitest.config.ts` — a coverage drop fails CI |


## 4. Codebase conventions

Follow these so reviewers don't have to ask.

### API (`apps/api`)

- **Module layout:** each feature is `src/<name>/` with `*.module.ts`,
  `*.controller.ts`, `*.service.ts`, `*.schema.ts`, and colocated `*.spec.ts`.
- **Auth:** routes are authenticated by default (global `ClerkAuthGuard`).
  Opt out explicitly with `@Public()` only when genuinely public (health,
  webhooks, signed files). Read the role from `req.auth.role`, never the client.
- **Validation:** every request body/query is a `class-validator` DTO —
  unknown fields are rejected (`forbidNonWhitelisted`), length-limit everything
  user-supplied.
- **Money/quota paths:** gate with `entitlements.consumeOrThrow()` **before**
  spending, `refund()` on failure. Never trust a prior `check()` alone.
- **Multi-document writes:** wrap in `withTransaction()` from
  `common/mongo-transaction.ts` (falls back gracefully on standalone Mongo).
- **Errors:** throw `HttpException` with the standard shape
  `{ statusCode, error, ...context }`. The global filter handles the rest.
- **Logging/metrics:** emit JSON lines via `common/json-logger.ts`; record
  business counters via `common/metrics.ts` (never `console.log` free-form).
- **Env access:** prefer `config.ts` helpers (`envInt`, `envBool`, …) over raw
  `process.env` reads; production-critical keys must be in
  `collectConfigIssues()`.
- **New env var?** Document it in `apps/api/.env.example` and, if
  operator-relevant, in `docs/OPERATIONS.md`.

### Web (`apps/web`)

- API access goes through `src/lib/api.ts` (`apiFetch`) — timeouts, retry with
  jitter, `x-request-id`, and `Idempotency-Key` on non-idempotent POSTs are
  already handled there; don't call `fetch` directly.
- Pages live in `src/app/<route>/`; shared UI in `src/components/`.
- The app refuses to serve in production with missing/malformed env
  (`src/instrumentation.ts`).

### Docs

- Update the doc that describes behavior you changed (see
  [INDEX](INDEX.md)); docs should never drift from the code.

## 5. Pull-request checklist

- [ ] `npm run lint:*` and `npm run typecheck:*` pass for touched packages
- [ ] `npm run test:api` (+ `test:e2e:api` for route changes) pass
- [ ] New behavior has tests (unit spec colocated; e2e for new routes)
- [ ] New env vars documented in `.env.example` (+ `docs/OPERATIONS.md`)
- [ ] Behavior changes reflected in `docs/` (architecture/runbook/compliance)
- [ ] No new secrets committed (`npm run check:secrets`; `.env*` is ignored)
- [ ] Coverage thresholds still met (CI enforces)

## 6. Getting help

- Architecture questions → [ARCHITECTURE.md](ARCHITECTURE.md)
- Production behavior, flags, runbooks → [OPERATIONS.md](OPERATIONS.md)
- Security issues → [SECURITY.md](../SECURITY.md) (never open a public issue)