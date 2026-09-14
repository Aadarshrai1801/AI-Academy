# Privacy Policy

> **DRAFT — not legal advice.** This is a working template that accurately
> describes what the software does today. Before publishing it to users, have
> qualified counsel review it and fill in the bracketed fields listed in
> `docs/COMPLIANCE.md`. Nothing here creates rights beyond what applicable law
> grants.

**Effective date:** [EFFECTIVE DATE] · **Last updated:** [EFFECTIVE DATE]

## 1. Who we are

[LEGAL ENTITY NAME] ("we", "us", "our") operates the AI Academy learning
platform (the "Service"). We are the data controller for the personal data
described in this policy.

- Registered address: [REGISTERED ADDRESS]
- Privacy contact: [PRIVACY CONTACT EMAIL]
- EU/UK representative (if applicable): [EU REPRESENTATIVE]

## 2. Scope

This policy covers `ai-academy` accounts and the web app, the API, and the mobile
app. It does not cover third-party websites or services we link to (for example
a YouTube video or a Stripe payment page).

## 3. What we collect

| Category | Examples | Source |
| --- | --- | --- |
| Account data | Name, email address, username, avatar URL, authentication identifiers and session metadata | You, via our auth provider (Clerk) |
| Profile & progress | Points, streak history, timezone, roles/entitlements, last activity date | Your use of the Service |
| Practice activity | Questions served, answers submitted, correctness, time taken, day buckets, per-topic analytics | Your use of the Service |
| Social data | Group memberships, group names, invite codes, chat messages (including reactions, read receipts, and any media you share), abuse reports | You and other members |
| AI features | Questions you submit to the AI tutor, generated answers, cached canonical answers, video render jobs and their status | You |
| Calls | Call participants, timestamps, duration, screen-share usage, abuse reports. **Calls are not recorded by default.** | You and other participants |
| Billing | Plan, subscription status, renewal dates, Stripe customer/subscription identifiers. **We never receive or store full card numbers.** | You, via Stripe |
| Usage & logs | IP address, user agent, request identifiers, error diagnostics, rate-limit counters | Automatic |
| Audit records | Acting user, action, target, IP, timestamp for administrative actions | Automatic, for accountability |

We do **not** use advertising trackers, sell personal data, or build advertising
profiles.

## 4. How we use it, and why it is lawful

| Purpose | Data used | Legal basis (GDPR art. 6) |
| --- | --- | --- |
| Provide the Service (accounts, practice, leaderboards, groups, AI features, calls) | Account, progress, social, AI, calls | Performance of a contract |
| Process payments and maintain billing records | Billing, account | Contract; legal obligation (tax/accounting) |
| Protect the Service (rate limiting, abuse reports, audit trail, fraud prevention) | Usage & logs, audit, reports | Legitimate interests (security and integrity) |
| Improve content quality and cost controls (aggregated statistics, cache hit rates) | Aggregated usage, AI queries (aggregated) | Legitimate interests |
| Respond to lawful requests and enforce our Terms | Varies | Legal obligation; legitimate interests |

Where we rely on consent (for example if we later introduce marketing emails or
optional features), you can withdraw it at any time without affecting prior use.

## 5. AI features and third-party model providers

When you ask the AI tutor a question, the question text is sent to a large
language model provider to generate an answer, and your query plus the answer is
stored in your private history. Video explainers are generated from the
canonical text of a question, not from your identity.

The specific providers are listed in `docs/COMPLIANCE.md`. We do not send your
name, email, or authentication identifiers to model providers, and our
agreements with them prohibit using your data to train their models (confirm
this in the signed DPAs — see `docs/COMPLIANCE.md`).

AI answers are generated automatically and may be incomplete or wrong. **They
are not professional, legal, medical, or financial advice.**

## 6. Sharing

We share personal data only with:

- **Subprocessors** that host and operate the Service (see `docs/COMPLIANCE.md`
  for the current list, regions, and purposes);
- **Other users**, to the extent you interact with them — for example your
  username, points, and rank appear on leaderboards, and group members see your
  messages and call participation;
- **Authorities**, when required by law or to protect rights, safety, and the
  integrity of the Service.

We do not sell personal data.

## 7. International transfers

Our subprocessors may process data outside your country. Where data leaves the
European Economic Area or the UK, we rely on appropriate safeguards such as the
European Commission's Standard Contractual Clauses and vendor transfer impact
assessments (see `docs/COMPLIANCE.md`).

## 8. Retention

We keep personal data for as long as your account exists and as needed for the
purposes above. Some data has shorter windows:

- free-tier chat visibility: 30 days (older messages are hidden from view);
- rate-limit counters: 60 seconds; quota counters: 24 hours (daily) / 31 days (monthly);
- live leaderboards: 3 days (historical ranking snapshots are retained until account deletion);
- billing records: retained as required by tax and accounting law (held by Stripe).

Full details, including enforcement status, are in `docs/COMPLIANCE.md`.
Deleting your account removes or anonymizes the data we hold about you.

## 9. Security

We use encryption in transit, least-privilege access, hashed credentials at
third-party providers, rate limiting, immutable audit records for administrative
actions, and a deny-by-default authorization model. No system is perfectly
secure; if you find a vulnerability, please follow `SECURITY.md`.

## 10. Your rights

Depending on where you live, you may have the right to:

- **access** and **export** your data — use `GET /users/me/export` or email us;
- **erase** your data — use `DELETE /users/me?confirm=DELETE` (in-app erasure),
  or email us to also remove your identity record held by our auth provider;
- **rectify** inaccurate data, **restrict** or **object** to processing,
  **withdraw consent**, and **port** your data;
- **lodge a complaint** with your local supervisory authority.

We respond to requests within 30 days. Exercising your rights will not
disadvantage you in any way.

## 11. Children

The Service is for people aged **13 or older**. We do not knowingly collect
personal data from children under 13. If you believe a child under 13 has
created an account, contact [PRIVACY CONTACT EMAIL] and we will delete the
account and associated data. In the European Economic Area/UK, where the
digital age of consent is 16 (or lower if your member state set one), users
below that age need parental consent; we ask users to confirm their eligibility
at sign-up and will add age-assurance measures as the Service grows.

## 12. Cookies and local storage

We use strictly necessary cookies and browser storage for authentication
(Clerk session), security, and preferences. Stripe may set cookies on its
checkout pages. We do not use advertising or cross-site tracking cookies. You
can block cookies in your browser, but sign-in and billing will not work.

## 13. Changes

We may update this policy. Material changes will be announced in the Service or
by email before they take effect, and the "Last updated" date will change.

## 14. Contact

Questions or requests: [PRIVACY CONTACT EMAIL].
Complaints: you may also contact your local data protection authority.
