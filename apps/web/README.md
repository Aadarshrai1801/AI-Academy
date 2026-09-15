# apps/web — AI Academy web app

Next.js (App Router) + React + TypeScript + Tailwind. Clerk for auth, thin
fetch layer in `src/lib/api.ts`, Sentry hooks in `src/instrumentation.ts`.

- **Read first:** [Architecture](../../docs/ARCHITECTURE.md) · [Development guide](../../docs/DEVELOPMENT.md)

## Quickstart

```bash
cp .env.example .env.local     # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev                    # http://localhost:3000 (API must be on :4000)
```

The app validates `NEXT_PUBLIC_API_URL` and Clerk keys at server start and
refuses to serve in production if they are missing or malformed.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/practice` | Question loop, grading, streak — includes the paywall modal on 429 |
| `/dashboard` | Streak, points, rank, plan, Data & privacy (GDPR export/erasure) |
| `/leaderboard` | Live top-10 + rank history/trends |
| `/ask` | AI tutoring: answers, YouTube recs, history, video requests |
| `/watch/[jobId]` | Explainer video render progress + playback |
| `/groups`, `/groups/[id]` | Groups, live chat, reactions, challenges, group board |
| `/calls`, `/calls/[id]` | Call history + live room (RealtimeKit) |
| `/pricing` | Stripe Checkout / Customer Portal entry points |
| `/admin`, `/admin/review`, `/admin/analytics`, `/admin/reports` | Admin: buffers, review queue, platform analytics, abuse reports |
| `/sign-in`, `/sign-up` | Clerk auth (sign-up requires the 13+ / Terms confirmation) |
| `/privacy`, `/terms` | Public policy pages |

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Local dev, production build, serve |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |

## Conventions

- **Always** call the API through `apiFetch` in `src/lib/api.ts` — it already
  handles timeouts, retry-with-jitter, `x-request-id` correlation, and sends an
  `Idempotency-Key` on non-idempotent POSTs (which the API enforces).
- Pages live in `src/app/<route>/`; shared UI components in `src/components/`.
- `AGENTS.md` / `CLAUDE.md` carry Next.js version-specific guidance for AI
  agents — read them before writing framework code (this Next version has
  breaking changes vs. older docs).