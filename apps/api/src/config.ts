/**
 * Boot-time configuration: a single place that loads `.env`, validates the
 * environment, and fails fast when a production deployment is misconfigured.
 *
 * Why this exists: the API used to read `process.env` from ~15 files with
 * silent fallbacks (`MONGODB_URI ?? localhost`, `VIDEO_SECRET ?? dev-secret`).
 * That is fine for local dev but hides operator mistakes in production — the
 * classic "deployed without CLERK_SECRET_KEY and silently ran an auth bypass".
 *
 * Rules:
 * - `loadEnvFile()` is idempotent and never overrides real env vars (Render,
 *   Docker, Vercel injected values always win).
 * - `assertBootConfig()` throws on production-only misconfiguration so the
 *   process exits before accepting traffic instead of failing open.
 * - Typed accessors (`envInt`, `envFloat`, `envBool`) replace the duplicated
 *   parsing helpers scattered across services.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export type NodeEnv = 'development' | 'test' | 'production';

export const nodeEnv = (): NodeEnv => {
  const raw = (process.env.NODE_ENV ?? 'development').toLowerCase();
  return raw === 'production' || raw === 'test' ? raw : 'development';
};

export const isProduction = (): boolean => nodeEnv() === 'production';
export const isTest = (): boolean => nodeEnv() === 'test';

/** Load `.env` (if present) without overriding already-set variables. */
export function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  let text: string;
  try {
    if (!existsSync(path)) return;
    text = readFileSync(path, 'utf8');
  } catch {
    return; // unreadable .env must never break boot; real env vars still work
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Dev-only auth passthrough (ClerkAuthGuard). Never enabled in production.
 * Enterprise default is fail-closed: explicit opt-in via ALLOW_DEV_AUTH_BYPASS=true. */
export const devAuthBypassEnabled = (): boolean =>
  !isProduction() && process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

/**
 * Quota/entitlement degradation policy when Redis is unavailable.
 * Dev: allow (keep local flows working). Production: deny (fail closed — a
 * quota outage must never become unlimited free usage).
 */
export const quotaFailOpen = (): boolean => {
  if (process.env.QUOTA_FAIL_OPEN === 'true') return !isProduction();
  if (process.env.QUOTA_FAIL_OPEN === 'false') return false;
  return !isProduction();
};

export const envStr = (key: string, fallback = ''): string =>
  process.env[key]?.trim() || fallback;

export function envInt(key: string, fallback: number, opts: { min?: number } = {}): number {
  const value = Number(process.env[key]);
  const min = opts.min ?? 1;
  return Number.isFinite(value) && value >= min ? value : fallback;
}

export function envFloat(key: string, fallback: number, opts: { min?: number; max?: number } = {}): number {
  const value = Number(process.env[key]);
  if (!Number.isFinite(value)) return fallback;
  if (opts.min !== undefined && value < opts.min) return fallback;
  if (opts.max !== undefined && value > opts.max) return fallback;
  return value;
}

export function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0' && value !== 'no';
}

export interface ConfigIssue {
  key: string;
  message: string;
}

/**
 * Production requirements. Anything in this list is a hard boot failure:
 * continuing with these unset means unauthenticated traffic, forgeable signed
 * URLs, or unroutable CORS. Non-production returns no issues.
 */
export function collectConfigIssues(env: NodeJS.ProcessEnv = process.env): ConfigIssue[] {
  if ((env.NODE_ENV ?? 'development').toLowerCase() !== 'production') return [];
  const issues: ConfigIssue[] = [];
  const missing = (key: string, message: string) => issues.push({ key, message });
  const has = (key: string) => Boolean(env[key]?.trim());

  if (!has('MONGODB_URI')) missing('MONGODB_URI', 'Mongo connection string is required in production.');
  if (!has('CLERK_SECRET_KEY')) missing('CLERK_SECRET_KEY', 'Without Clerk there is no authentication — refusing to boot.');
  if (!has('REDIS_URL')) missing('REDIS_URL', 'Rate limiting and quotas fail open without Redis — refusing to boot.');
  if (!has('VIDEO_SECRET')) missing('VIDEO_SECRET', 'Signed video playback URLs would be forgeable — refusing to boot.');
  if (env.VIDEO_SECRET !== undefined && env.VIDEO_SECRET.trim().length < 16) {
    missing('VIDEO_SECRET', 'VIDEO_SECRET must be at least 16 characters.');
  }
  if (!has('CORS_ORIGINS') && !has('WEBAPP_URL')) {
    missing('CORS_ORIGINS', 'Set CORS_ORIGINS (comma-separated) or WEBAPP_URL so browser origins are allow-listed.');
  }
  if (has('STRIPE_SECRET_KEY')) {
    if (!has('STRIPE_WEBHOOK_SECRET')) {
      missing('STRIPE_WEBHOOK_SECRET', 'Stripe is enabled but webhook signatures cannot be verified.');
    }
    if (!has('STRIPE_PRICE_MONTHLY') || !has('STRIPE_PRICE_ANNUAL')) {
      missing('STRIPE_PRICE_MONTHLY', 'Stripe is enabled but STRIPE_PRICE_MONTHLY/STRIPE_PRICE_ANNUAL are not both set.');
    }
  }

  // Partial R2 config produces broken uploads at request time instead of at boot.
  const r2Keys = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const r2Set = r2Keys.filter((k) => has(k));
  if (r2Set.length > 0 && r2Set.length < r2Keys.length) {
    missing(r2Keys.find((k) => !has(k))!, `Cloud storage is partially configured (${r2Set.join(', ')}); set all R2_* keys or none.`);
  }
  return issues;
}

/** Throw with an actionable message when production config is incomplete. */
export function assertBootConfig(env: NodeJS.ProcessEnv = process.env): void {
  const issues = collectConfigIssues(env);
  if (issues.length === 0) return;
  const lines = issues.map((i) => `  - ${i.key}: ${i.message}`);
  throw new Error(
    `Refusing to start: ${issues.length} configuration problem(s) in production.\n${lines.join('\n')}\n` +
      'Fix the environment (or set NODE_ENV=development for local work) and restart.',
  );
}

/** Version string for health/ready endpoints and Sentry releases. */
export function appVersion(): string {
  return (
    process.env.GIT_COMMIT ??
    process.env.RENDER_GIT_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.npm_package_version ??
    'dev'
  );
}
