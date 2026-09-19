# DELETE-CANDIDATES.md — Phase 0 audit

Audit date: 2026-09-19. Scope: `apps/api`, `apps/web`, `apps/mobile`,
`packages/shared`. Method: ripgrep import/usage scans + per-file dependency
cross-checks (node_modules excluded).

> **Status (same day):** user reviewed this file and approved the non-Stripe
> cleanups. §A2 lists what was executed; §B1/§B2/§B3 reflect the decisions
> (mobile kept, Stripe env keys and `CALL_MAX_GROUP_SIZE` left for the owner,
> auth tightening and legal placeholders untouched).

---

## A. Auto-deleted (clearly dead — done in this phase)

| Item | Why it is dead |
|---|---|
| `apps/api/src/common/pagination.dto.ts` | Zero importers repo-wide. Only file in `src/` with no importer. (Exports `PaginationQuery`, `Page`, `toPage`.) |
| `source-map-support` (apps/api devDep) | Zero imports; runtime source maps come from `NODE_OPTIONS=--enable-source-maps` in the Dockerfile. |
| `@nestjs/schematics` (apps/api devDep) | Not referenced by any script; it remains available transitively via `@nestjs/cli`, so `nest generate` still works. |
| Phantom dep: `dotenv` (undeclared import) | `seed.ts`/`promote.ts` imported `dotenv/config` without `dotenv` in `package.json` (worked only via hoisting from `@nestjs/config`). Replaced with the project's own `loadEnvFile()` from `src/config.ts`. |
| `.env.example` prose lines 10–13 | Un-commented prose (missing `#`); technically skipped by every dotenv parser but a trap for others. Commented out. |

### Safety fixes (extensions, not deletions)

- **`npm run seed` production guard** — `apps/api/src/seed.ts` now refuses any
  non-local `MONGODB_URI` (or `NODE_ENV=production`) unless `CONFIRM_SEED=yes`,
  and always logs the target host with credentials stripped. Verified: refuses
  `mongodb+srv://…cluster.example.net` with exit 1; localhost quickstart is
  unchanged. (Your local `apps/api/.env` points at a live Atlas cluster — this
  is exactly the accident it now prevents.)
- **Uncommitted WIP repairs** (your messages/DM branch was red before Phase 0):
  - `calls.service.ts` — the "paused in favor of DMs" edit threw unconditionally
    but left the old function body dangling → syntax errors. Kept your pause,
    removed the unreachable remainder, trimmed now-unused imports. Original body
    is recoverable from git history (HEAD).
  - `messages.service.ts` — 3 type-only errors (`.lean()` cast, `shape()` returns
    `unknown` fields). Applied minimal casts; runtime behavior unchanged.

### A2. Approved & executed (non-Stripe cleanup, 2026-09-19)

| Item | Action |
|---|---|
| Unused web code: `IconButton` + `IconButtonProps` (button.tsx), `stagger` (motion.ts), `CallDTO` + `JoinResult` (api.ts), dead props `Card.accent` / `CardSpotlight.radius`, and the never-imported type re-exports in `components/ui/index.ts` / `components/charts/index.ts` | Deleted / de-exported; web typecheck, lint and `next build` stay green |
| `envStr()` in `apps/api/src/config.ts` (zero call sites) | Deleted |
| `transpilePackages: ["@ai-academy/shared"]` in `apps/web/next.config.ts` (package not a dependency, zero imports) | Removed |
| One-off icon scripts `apps/web/scripts/generate-icons.mjs` + `verify-icons.mjs` (not wired to any script/CI; outputs committed) | Deleted (recoverable from git history) |
| Missing env docs: `AUDIT_RETENTION_DAYS`, `RATE_LIMIT_PER_MIN`, `LEADERBOARD_SNAPSHOT`, `REDIS_COMMAND_BUDGET_GUARD`, `REDIS_STALLED_INTERVAL_MS`, `REDIS_DRAIN_DELAY_S`, `FFMPEG_PATH`, `RTK_PRESET_PARTICIPANT`, `CONFIRM_PROMOTE`, `CONFIRM_SEED`, `NEXT_PUBLIC_SITE_URL`; new `apps/mobile/.env.example` (`EXPO_PUBLIC_API_URL`) | Documented with commented defaults |

Still open by owner decision: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` /
`STRIPE_SECRET_KEY` in `apps/web/.env.example` (no web code reads them;
`STRIPE_SECRET_KEY` is an API secret) and `CALL_MAX_GROUP_SIZE` (never read;
calls are paused).

## B. ⏳ Awaiting go-ahead

### B1. Mobile shell — **decided: keep as-is**

Nothing changed. Contents (for the record):

| File | What it is |
|---|---|
| `apps/mobile/App.tsx` (97 LOC) | Expo starter screen: leaderboard fetch + one practice question; token pasted manually |
| `apps/mobile/src/lib/api.ts` (81 LOC) | Typed fetch client mirroring web (`EXPO_PUBLIC_API_URL`, 15s timeout, request-id, Idempotency note) |
| `apps/mobile/README.md` | Says "starter, typecheck-only, not shipped" |
| `app.json`, `babel.config.js`, `tsconfig.json`, `package.json` | Expo SDK 52 config |
| CI | `mobile (typecheck)` job; `npm audit --audit-level=critical` |

**Options:** (a) keep as-is (recommended — CI already typechecks it, README is
explicit it is not a supported surface); (b) delete the app + CI job + root
`dev:mobile`/`typecheck:mobile` scripts + README/INDEX references; (c) keep but
move to `examples/`. I will not touch it until you pick.

### B2. Unused exports — ✅ executed (see §A2)

| Export | Location | Notes |
|---|---|---|
| `envStr` | `apps/api/src/config.ts:89` | Zero call sites |
| `IconButton` + `IconButtonProps` | `apps/web/src/components/ui/button.tsx` | Never used; thin `Button` wrapper. `ButtonProps` also never imported |
| `stagger` | `apps/web/src/lib/motion.ts:36` | Never imported (`page.tsx` uses `StaggeredHeadline`, not this) |
| `CallDTO`, `JoinResult` | `apps/web/src/lib/api.ts:342,359` | Zero importers (and calls are now paused) |
| Prop types: `CardProps`, `BadgeProps`/`BadgeVariant`/`BadgeSize`/`Difficulty` (badge.tsx), `AnimatedNumberProps`, `ProgressTone`/`ProgressBarProps`/`ProgressRingProps`, `EmptyStateProps`, `LogoMarkProps`, `ToastOptions`/`ToastVariant`, `AreaPoint`/`AreaChartProps`, `TopicBarRow`, `DashboardKpisProps`, `AvatarStackProps`, `NavItem`/`Crumb`, `RankBoardProps`, `SpeedTimerProps`, `OptionCardProps`, `UserMenuProps`, `RichAnswerProps` | re-exported from `components/ui/index.ts` etc. | Type-surface only; deleting is compile-safe but breaks nobody. |
| Dead props `Card.accent`, `CardSpotlight.radius` | `components/ui/card.tsx`, `components/ui/aceternity/card-spotlight.tsx` | Ignored with `void _`; zero call sites |

### B3. Config / env — non-Stripe items ✅ executed; two owner decisions remain

| Item | Finding | Proposed action |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` in `apps/web/.env.example` | Zero web-code references (web has no Stripe SDK). `STRIPE_SECRET_KEY` is an API secret and does not belong in a web env | Remove both from web example (Stripe-adjacent → your go-ahead) |
| `CALL_MAX_GROUP_SIZE` in `apps/api/.env.example:94` | Never read; `MAX_GROUP_CALL_SIZE = 10` is hardcoded in `calls/policy.ts` | Either wire it via `envInt` (keeps the documented knob) or drop the line. Calls are paused → your WIP area |
| `.env.example` missing vars read by code | `AUDIT_RETENTION_DAYS`, `RATE_LIMIT_PER_MIN`, `LEADERBOARD_SNAPSHOT`, `REDIS_COMMAND_BUDGET_GUARD`, `REDIS_STALLED_INTERVAL_MS`, `REDIS_DRAIN_DELAY_S`, `FFMPEG_PATH`, `RTK_PRESET_PARTICIPANT`, `CONFIRM_PROMOTE`, `CONFIRM_SEED`; web: `NEXT_PUBLIC_SITE_URL`; mobile: `EXPO_PUBLIC_API_URL` | Document with commented defaults (no behavior change) |
| `transpilePackages: ["@ai-academy/shared"]` | `apps/web/next.config.ts:6` references the package, but it is not in web deps and nothing imports it | Remove entry, or add the dep + start using contracts in a later phase |
| One-off icon scripts | `apps/web/scripts/generate-icons.mjs`, `verify-icons.mjs` — not wired to any npm script or CI; outputs committed | Delete, or wire as `icons:generate`/`icons:verify` |
| `CardSpotlight` | Superseded by `Card` (glow layer removed); still used by 10+ files | Not orphaned — defer a refactor, do not delete now |

### B4. Auth/quota-adjacent (no change without your go-ahead)

- `POST /questions/seed`: any authenticated user can bootstrap an empty bank;
  only non-empty top-ups are admin-gated. Recommend `AdminGuard` for both paths
  (strengthens, does not weaken, existing auth).
- Health/seed note: `apps/api/.env` (gitignored) contains live-looking Atlas /
  Redis / Stripe / Groq credentials plus stale `UPSTASH_REDIS_REST_*` and
  `STRIPE_PUBLISHABLE_KEY` keys. The file is not tracked, so nothing was
  changed — but if it has ever been shared, rotate those keys. I did not read
  or copy the values.

### B5. Legal placeholders — needs a human, do not auto-fill

All bracketed placeholders still present (dates were already filled 2026-09-15):

| File | Placeholders (line refs) |
|---|---|
| `LICENSE` | `[LEGAL ENTITY NAME]` (3), `[REGISTERED ADDRESS]` (3), `[LEGAL CONTACT EMAIL]` (31) |
| `SECURITY.md` | `[security@example.com]` (28) — fallback inbox |
| `PRIVACY.md` | `[LEGAL ENTITY NAME]` (13), `[REGISTERED ADDRESS]` (17), `[PRIVACY CONTACT EMAIL]` (18, 131, 151), `[EU REPRESENTATIVE]` (19) |
| `TERMS.md` | `[LEGAL ENTITY NAME]` (11), `[SECURITY CONTACT EMAIL]` (24), `[REFUND POLICY]` (83), `[LIABILITY CAP]` (118), `[PRIVACY CONTACT EMAIL]` (131), `[GOVERNING JURISDICTION]` (138), `[VENUE]` (140), `[DISPUTE RESOLUTION / ARBITRATION CLAUSE IF DESIRED]` (141), `[LEGAL CONTACT EMAIL]` (151) |
| `apps/web/src/app/privacy/page.tsx` | `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, `[PRIVACY CONTACT EMAIL]` (27, 29, 104, 120) — public copy mirrors PRIVACY.md and must be filled together |
| `apps/web/src/app/terms/page.tsx` | `[LEGAL CONTACT EMAIL]` (32, 138), `[LIABILITY CAP]` (114), `[GOVERNING JURISDICTION]` (130), `[VENUE]` (131) |
| `docs/COMPLIANCE.md` | every `[REGION]` (§3 table, 12 rows), `[INCIDENT CONTACTS]` (§6), `[PRIVACY CONTACT EMAIL]` (§7) |

`docs/COMPLIANCE.md` §10 already tracks ownership/status for these — no code
change proposed.

## C. Verified NOT dead (leave alone)

- **No debug scaffolding**: zero `console.log`/`console.debug`/`debugger` in
  `apps/web/src`. `console.*` in `apps/api` are intentional degraded-path /
  deploy-visibility logs (each has an `eslint-disable` comment or CLI purpose).
- **Aceternity UI + landing components**: all imported; earlier cleanup commit
  already removed the unused ones.
- **`packages/shared` exports**: not imported by apps (by design note in the
  file), but all 12 value exports are exercised by `packages/shared/test`.
- **`@nestjs/mau`**: backs the `deploy` script (`nest deploy` resolves its
  binary) — keep.
- **`apps/mobile` package-lock**: required by the CI typecheck job while the app
  exists.

## D. Test/typecheck baseline (this phase)

| Check | Before cleanup | After cleanup |
|---|---|---|
| api typecheck | ❌ 20+ syntax errors (WIP `calls.service.ts`) | ✅ |
| api lint | ✅ | ✅ |
| api unit tests | n/a (build red) | ✅ 134 passed, 6 skipped (Redis-dependent) |
| api e2e | n/a | ✅ 2 passed |
| web typecheck / lint | ✅ / ✅ | ✅ / ✅ |
| shared build + tests | ✅ 10 passed | ✅ 10 passed |
| mobile typecheck | ✅ | ✅ |

Docker was not running locally, so Redis-backed specs skipped as designed; e2e
is DB-free by design. `apps/web` full `next build` is deferred to the first
phase that touches web code.
