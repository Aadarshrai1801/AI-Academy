# Compliance & data protection

> **Working document, not legal advice.** It records what the software actually
> does, so counsel and operators can approve the public policies. Filled-in
> values must match `LICENSE`, `SECURITY.md`, `PRIVACY.md`, `TERMS.md`, and the
> web pages at `/privacy` and `/terms`.

**Contents:** [1. Data map](#1-data-map-ropa-style) ·
[2. Retention](#2-retention-schedule--enforcement-status) ·
[3. Subprocessors](#3-subprocessors) ·
[4. International transfers](#4-international-transfers) ·
[5. Security controls](#5-security-controls-implemented) ·
[6. Breach response](#6-breach-response) ·
[7. DSARs](#7-data-subject-requests-dsar) ·
[8. Children](#8-children) ·
[9. Open items](#9-open-items-prioritized) ·
[10. Placeholder checklist](#10-placeholder-fill-in-checklist)

## 1. Data map (ROPA-style)

| Data | Storage | Purpose | Legal basis | Retention |
| --- | --- | --- | --- | --- |
| Account (name, email, username, avatar, auth IDs, last login) | Clerk + Mongo `users` | Provide accounts, authenticate, personalize | Contract | Until erasure; then Clerk record deleted separately |
| Progress (attempts, correctness, time, topics, points) | Mongo `attempts`, `users` | Practice, scoring, analytics | Contract | Until erasure |
| Streaks | Mongo `streaks`, `users` | Habit tracking, leaderboards | Contract | Until erasure |
| Leaderboard snapshots (rank, score, accuracy) | Mongo `leaderboard_snapshots` | Rank history, trends | Contract / legitimate interest | User entry removed on erasure; aggregates retained |
| Groups (name, members, invite codes) | Mongo `groups` | Social learning | Contract | Soft-deleted on group delete; purge pending |
| Messages (content, reactions, read receipts, reports) | Mongo `messages` | Group chat | Contract | Free tier hidden after 30 days; deleted on erasure; hard-delete job pending |
| AI queries and answers | Mongo `ai_queries`, `canonical` | Tutoring, caching | Contract | Deleted on erasure |
| Video jobs (script, status, file keys) | Mongo `video_jobs`, R2/disk | Explainer videos | Contract | Deleted on erasure (objects included) |
| Calls (participants, duration, reports) | Mongo `calls` | Call history, abuse handling, billing | Contract / legitimate interest | Deleted/anonymized on erasure; no recordings by default |
| Billing (plan, status, provider IDs) | Mongo `subscriptions` + Stripe | Payments, entitlements, tax | Contract / legal obligation | Local cache deleted on erasure; Stripe records per tax law |
| Rate-limit and quota counters | Redis | Abuse prevention, entitlements | Legitimate interest / contract | 60 s (rate), 24 h/31 d (quota), 3 d (live board) |
| Quota usage ledger | Mongo `quota_usage` | Durable entitlement accounting across Redis restarts | Contract | Until erasure (period rows) |
| Audit events (actor, action, target, IP) | Mongo `audit_events` | Accountability for admin actions | Legitimate interest | Retain per security policy (see §5) |
| Error diagnostics (request id, path, stack) | Sentry (when configured) | Reliability | Legitimate interest | Vendor retention; configure to ≤ 90 days |
| Access logs (method, path, status, ms, user, IP) | Host stdout (JSON lines) | Reliability, abuse investigation | Legitimate interest | Host log retention policy |

## 2. Retention schedule — enforcement status

**Implemented:**

- quota counters expire via Redis TTL (24 h daily / 31 d monthly);
- rate-limit windows expire after 60 s;
- live leaderboards expire after 3 days;
- account erasure (`DELETE /users/me?confirm=DELETE`) deletes or anonymizes
  every collection above, scrubs Redis boards and ranking snapshots, and removes
  local + R2 video objects.
- soft-deleted row purges (`apps/api/src/admin/retention.service.ts`, audited):
  `POST /admin/retention/purge-messages` hard-deletes `messages.deleted = true`
  rows past `RETENTION_SOFT_DELETE_GRACE_DAYS` (default 30);
  `POST /admin/retention/purge-groups` hard-deletes `groups.deleted = true`
  rows past the same window plus their messages; `GET /admin/retention/status`
  dry-runs both counts.

**Pending (tracked gaps):**

- **visible-message hard-delete past the free-tier window** — the 30-day
  free-tier window is still a read filter (`apps/api/src/messages/policy.ts`).
  Message rows do not record the sender's tier at send time while `pro`/`admin`
  retention is infinite, so a blind `created_at` purge would destroy Pro
  history; either track the sender tier or adopt a documented policy that
  messages are retained for the life of the group/account.
- **orphaned video objects** — R2 objects whose job row is gone (failed
  uploads, manual DB edits) are not garbage-collected; use bucket lifecycle
  rules as the backstop.
- Sentry/host log retention is whatever the plan provides; set it explicitly.

## 3. Subprocessors

Record the signed DPA date and region for each before launch.

| Vendor | Purpose | Data | Region | DPA signed |
| --- | --- | --- | --- | --- |
| Clerk | Authentication | Account, session metadata | [REGION] | [ ] |
| Stripe | Payments | Billing identifiers, email | [REGION] | [ ] |
| MongoDB Atlas | Primary database | All application data | [REGION] | [ ] |
| Redis provider (Upstash/Redis Cloud) | Quotas, leaderboards, queues | User IDs, counters, job payloads | [REGION] | [ ] |
| Cloudflare R2 | Video object storage | Rendered mp4 files | [REGION] | [ ] |
| Cloudflare RealtimeKit | Video/audio calls | Live media, participant metadata | [REGION] | [ ] |
| Ably | Realtime chat fan-out | Message events | [REGION] | [ ] |
| Sentry | Error monitoring | Error payloads, request IDs, IP | [REGION] | [ ] |
| LLM provider (Groq/Anthropic) | AI questions/answers, scripts | Question text, canonical answer text | [REGION] | [ ] |
| Google (YouTube Data API) | Video recommendations | Search query text | [REGION] | [ ] |
| ElevenLabs (optional) | Narration audio | Canonical answer text | [REGION] | [ ] |
| Hosting (Render/Vercel) | Application hosting | All data at rest/in transit | [REGION] | [ ] |

Confirm in each DPA that customer data is **not used to train models** (LLM and
TTS providers) and that sub-processors are disclosed.

## 4. International transfers

If users are in the EEA/UK and a vendor processes outside those regions, rely on
Standard Contractual Clauses + transfer impact assessments. Document the chosen
regions in the table above; prefer EU regions for Mongo/Redis/hosting if you
serve EU users.

## 5. Security controls (implemented)

- deny-by-default authentication with an explicit public allow-list;
- server-side RBAC resolved from the database (never from client claims);
- boot-time configuration validation; production refuses to start misconfigured;
- rate limiting with `Retry-After` enforcement and fail-closed quotas;
- atomic quota enforcement (denied requests never consume quota; durable
  `quota_usage` ledger survives Redis restarts);
- `Idempotency-Key` enforcement on non-idempotent POSTs (replay-safe responses);
- Stripe webhook signature verification with a persistent idempotency ledger;
- HMAC-signed video playback URLs with constant-time comparison;
- transactional writes for points/streaks/billing where the database supports it;
- append-only administrative audit trail with actor, target, and IP;
- request IDs + centralized error handling that never leaks 5xx internals;
- Prometheus metrics endpoint (RED + business counters) with optional bearer
  token, and structured JSON access logs that strip querystrings;
- CI gates: lint, typecheck, unit + e2e tests, contract tests, coverage
  thresholds, secret scanning, dependency audit, Dependabot updates.

Operator controls to add: secret manager, branch protection/required checks,
GitHub secret scanning + push protection, Atlas PITR backups, vendor region
selection, alert routing (see [Operations](OPERATIONS.md)).

## 6. Breach response

1. **Contain** — revoke exposed credentials, isolate affected systems
   (rotate `CLERK_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VIDEO_SECRET`, R2 keys,
   database credentials as applicable).
2. **Assess** — scope of data and users affected, risk to rights and freedoms.
3. **Notify** — supervisory authority within **72 hours** where required;
   affected users without undue delay when high risk. Document what happened,
   when, and the remediation (breach register).
4. **Remediate & review** — fix the root cause, add detection, run a post-mortem.
5. Contacts and on-call routing: [INCIDENT CONTACTS].

Run a tabletop exercise before public launch.

## 7. Data subject requests (DSAR)

| Request | Mechanism | Target |
| --- | --- | --- |
| Access / portability | `GET /users/me/export` (JSON, capped per collection) | 30 days |
| Erasure | `DELETE /users/me?confirm=DELETE` + Clerk + R2 follow-ups | 30 days |
| Rectification | Account settings / support | 30 days |
| Objection / restriction | [PRIVACY CONTACT EMAIL] | 30 days |

Verify identity via the authenticated session (never over email alone). Log the
request, the actions, and the completion date. Erasure currently covers the
application database, Redis, local files, and R2 objects; the Clerk identity
record is deleted via the Clerk dashboard or a `user.deleted` webhook (API
handler pending). Users can self-serve both flows from the dashboard
("Data & privacy").

## 8. Children

Policy: **13+ only** (COPPA baseline); no targeted advertising; minimal data.
The web sign-up page requires an "I am 13 or older and accept the Terms and
Privacy Policy" confirmation before rendering the sign-up form. Server-side
enforcement and consent records are pending: the recommended implementation is
a Clerk `user.created` webhook that provisions the user plus a
`terms_accepted_at`/`age_confirmed_at` record, and a `user.deleted` webhook for
deprovisioning. EEA/UK: apply the local digital age of consent (16 by default)
where lower ages were not adopted.

## 9. Open items (prioritized)

> Split 2026-09-15: items marked **no-registration** need only an operator
> decision or inbox — no company registration, filing, or counsel required.
> Items marked **deferred** require registration, a signed legal instrument, or
> counsel review, and are removed from the launch-blocking list until then.
> Nothing below is legal advice; deferred sections stay in the documents as
> explicit TBDs rather than being deleted, so the documents never overstate
> what is settled.

1. Fill every bracketed placeholder (checklist in §10) and have counsel review. **Deferred** — entity, address, jurisdiction, caps, and counsel sign-off.
2. Enable GitHub private vulnerability reporting (referenced by `SECURITY.md`). **No-registration** — dashboard click.
3. Sign DPAs; record dates and regions in §3. **Deferred** — signed instruments + region decisions.
4. Implement the Clerk webhooks for provisioning/consent/deprovisioning. **No-registration** — code + Clerk dashboard.
5. Implement the retention jobs listed in §2. **No-registration** — code + operator runbook (soft-delete purges already shipped; visible-message window, R2 lifecycle, and log retention remain).
6. Third-party license notice generation at release
   (`license-checker` or CycloneDX SBOM). **No-registration** — build step.
7. Vendor region decision + data-residency statement if serving the EU/UK. **Deferred** — commercial/transfer decisions.
8. Incident-response rehearsal and alert routing (Sentry + uptime monitor). **No-registration** — operator drills + config.
9. Accessibility review against WCAG 2.2 AA (legal exposure in the EU/UK). **No-registration** to run the review; legal exposure assessment itself is **deferred** to counsel.
10. Enterprise readiness (SOC 2 / ISO 27001) only if selling to organizations. **Deferred** — audits.

## 10. Placeholder fill-in checklist

| File | Placeholders |
| --- | --- |
| `LICENSE` | `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, `[LEGAL CONTACT EMAIL]` — **deferred** (registration + counsel) |
| `SECURITY.md` | `[security@example.com]` — **no-registration** (inbox + dashboard click); intentionally left as TODO per owner choice |
| `PRIVACY.md` | dates done 2026-09-15; remaining `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, `[PRIVACY CONTACT EMAIL]` (TODO per owner choice), `[EU REPRESENTATIVE]` — **deferred** except inbox |
| `TERMS.md` | dates done 2026-09-15; remaining `[LEGAL ENTITY NAME]`, `[SECURITY CONTACT EMAIL]` + `[LEGAL CONTACT EMAIL]` (TODO per owner choice), `[REFUND POLICY]`, `[LIABILITY CAP]`, `[GOVERNING JURISDICTION]`, `[VENUE]`, `[DISPUTE RESOLUTION]` — **deferred** |
| `apps/web/src/app/privacy/page.tsx` | date done 2026-09-15; remaining `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, `[PRIVACY CONTACT EMAIL]` — **deferred** except inbox |
| `apps/web/src/app/terms/page.tsx` | date done 2026-09-15; remaining `[LEGAL ENTITY NAME]`, `[LEGAL CONTACT EMAIL]`, `[GOVERNING JURISDICTION]` — **deferred** except inbox |
| `docs/COMPLIANCE.md` | every `[REGION]`, `[INCIDENT CONTACTS]`, `[PRIVACY CONTACT EMAIL]` |