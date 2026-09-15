# Security Policy

> Fill in the bracketed values before publishing: see the checklist in
> [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md#10-placeholder-fill-in-checklist).
> Private vulnerability reporting on GitHub must be turned on in
> **Settings → Code security and analysis**.

**Related:** [Documentation index](docs/INDEX.md) ·
[Compliance notes](docs/COMPLIANCE.md) · [Operations runbook](docs/OPERATIONS.md)

## Supported versions

The `main` branch and the latest production deployment receive security fixes.
Older deployments, forks, and self-hosted copies are the responsibility of their
operators.

| Version             | Supported |
| ------------------- | --------- |
| `main` / production | ✅        |
| Older tags / forks  | ❌        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

1. Preferred: use GitHub's **Report a vulnerability** button on this repository
   (private vulnerability reporting).
2. Fallback: email [security@example.com] with the subject `SECURITY: <summary>`.

Include as much of the following as you can:

- a clear description and severity assessment;
- the affected component (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`)
  and endpoint/route;
- minimal reproduction steps or a proof of concept;
- whether the issue requires an authenticated account;
- your preferred contact and any disclosure timeline constraints.

## What to expect

- **Acknowledgement** within 2 business days.
- **Initial triage** (severity, affected versions, workaround) within 5 business days.
- **Fix and coordinated disclosure** targeted within 90 days, sooner for critical
  issues. We will keep you updated and credit you if you wish.

We do not currently operate a paid bug bounty program. We are happy to
acknowledge good-faith researchers in the fix notes.

## Safe harbor

We consider security research conducted in good faith under this policy to be
authorized. You must:

- only test accounts and data you own or control (never other users' data);
- avoid privacy violations, data destruction, and service degradation (no
  denial-of-service, no automated high-volume scanning);
- give us reasonable time to fix the issue before public disclosure.

We will not pursue legal action for research that follows these rules.

## Scope

In scope:

- `apps/api` (NestJS), `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared`;
- authentication/authorization, quota enforcement, billing webhooks, file
  playback tokens, and data-erasure flows.

Out of scope:

- third-party services and their integrations (Clerk, Stripe, MongoDB Atlas,
  Redis provider, Cloudflare R2/RealtimeKit, Ably, Sentry, LLM providers) —
  report those to the vendor;
- known dependency advisories already tracked by Dependabot;
- social engineering, physical attacks, and spam/DoS.

## Secrets

The repository must never contain live credentials. `scripts/check-secrets.mjs`
runs in CI on every push and pull request and fails on high-signal credential
patterns; `.env*` files other than the `.env.example` templates are git-ignored.
If you believe a credential has been committed, report it as above — we rotate
first and investigate second.
