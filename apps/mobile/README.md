# apps/mobile — AI Academy mobile (starter)

Expo (SDK 52) + React Native shell that mirrors the web practice loop against
the same API contract. **Status: starter** — it is typechecked in CI but not
shipped; treat it as a foundation, not a supported surface yet.

## Quickstart

```bash
cp ../../apps/api/.env.example ../../apps/api/.env   # API must be running
npm install
npm run start        # Expo dev server (scan the QR code)
npm run typecheck    # what CI runs
```

Point the shell at your API base URL (see `App.tsx`) — for a physical device
use your machine's LAN IP rather than `localhost`.

## Scope today

- Fetches the leaderboard and a practice question to prove the contract works
  on device.
- Everything else (auth flow, quizzes, chat, calls) lives in `apps/web` for
  now; build mobile features by reusing the same endpoints documented in
  [Architecture](../../docs/ARCHITECTURE.md).

## Adding features

1. Keep API access in one module (mirroring `apps/web/src/lib/api.ts`):
   timeouts, retries for idempotent GETs, and an `Idempotency-Key` on POSTs.
2. Respect entitlements: surface the API's 429 (`feature`, `limit`, `resetAt`)
   as an upsell prompt instead of a generic error.
3. Run `npm run typecheck` before opening a PR — that is the CI gate.