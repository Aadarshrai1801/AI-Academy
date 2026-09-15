# Documentation index

Everything you need to understand, build, run, and operate AI Academy.
Not sure where to start? Pick your role:

## 🧑‍💻 New contributor
1. [Root README](../README.md) — what this project is, quickstart
2. [Development guide](DEVELOPMENT.md) — local setup, scripts, testing, conventions
3. [Architecture](ARCHITECTURE.md) — how the pieces fit (read after your first run)

## 🚀 Operator / DevOps
1. [Operations runbook](OPERATIONS.md) — boot safety, health, metrics, queues, deploys, secrets
2. [Cost control](COSTS.md) — spend levers, budgets, self-host triggers
3. [Compliance notes](COMPLIANCE.md) — data map, retention, subprocessors, DSARs

## ⚖️ Legal / privacy review
1. [Compliance notes](COMPLIANCE.md) — what the software actually does
2. Public policies: [`PRIVACY.md`](../PRIVACY.md) · [`TERMS.md`](../TERMS.md) · [`SECURITY.md`](../SECURITY.md)
3. Placeholder checklist: [Compliance §10](COMPLIANCE.md#10-placeholder-fill-in-checklist)

## 🐛 Security researchers
[Security policy](../SECURITY.md) — how to report, scope, safe harbor.

## All documents

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Project overview, quickstart, feature map |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design: modules, request lifecycle, data stores, degradation policy |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Contributor guide: setup, workflows, testing, conventions |
| [`OPERATIONS.md`](OPERATIONS.md) | Production runbook: config, metrics/alerts, queues, deploys, DR, secrets |
| [`COSTS.md`](COSTS.md) | AI & infrastructure cost levers, budgets, self-hosting triggers |
| [`COMPLIANCE.md`](COMPLIANCE.md) | Data protection: ROPA data map, retention, subprocessors, breach & DSAR procedures |
| [`../SECURITY.md`](../SECURITY.md) | Vulnerability disclosure policy |
| [`../PRIVACY.md`](../PRIVACY.md) | Privacy policy (draft — placeholders pending) |
| [`../TERMS.md`](../TERMS.md) | Terms of service (draft — placeholders pending) |
| [`../apps/api/README.md`](../apps/api/README.md) | API service guide |
| [`../apps/web/README.md`](../apps/web/README.md) | Web app guide |
| [`../apps/mobile/README.md`](../apps/mobile/README.md) | Mobile app guide |

## Documentation conventions

- Anything marked **[operator]** requires accounts/decisions outside the repo.
- Bracketed values like `[PRIVACY CONTACT EMAIL]` are fill-in placeholders
  tracked in [Compliance §10](COMPLIANCE.md#10-placeholder-fill-in-checklist).
- Docs describe what the code **actually does today** — when you change
  behavior, update the matching doc in the same PR.