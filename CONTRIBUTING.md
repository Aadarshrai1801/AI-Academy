# Contributing

Thanks for helping improve AI Academy. The full contributor guide lives in
**[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** — setup, scripts, testing
strategy, code conventions, and the PR checklist.

Quick version:

1. `docker compose up -d mongo redis`, install per package, `npm run seed:api`.
2. Branch from `main`; keep changes focused.
3. Run `lint`, `typecheck`, and `test` for any package you touched.
4. Add tests for new behavior (colocated `*.spec.ts`; e2e for new routes).
5. Document new env vars in `.env.example` and update the matching doc in `docs/`.
6. Open a PR — CI must pass (lint, typecheck, build, unit + e2e, coverage
   thresholds, secret scan, dependency audit).

**Security issues:** do **not** open a public issue — follow
[SECURITY.md](SECURITY.md).

**Questions about the design?** [Architecture](docs/ARCHITECTURE.md) ·
[Documentation index](docs/INDEX.md)