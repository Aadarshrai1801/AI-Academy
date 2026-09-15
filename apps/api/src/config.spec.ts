import {
  assertBootConfig,
  collectConfigIssues,
  devAuthBypassEnabled,
  quotaFailOpen,
  throttleFailClosed,
} from './config.js';

const PROD_BASE = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://localhost:27017/x',
  CLERK_SECRET_KEY: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  REDIS_URL: 'redis://localhost:6379',
  VIDEO_SECRET: '0123456789abcdef0123456789abcdef',
  CORS_ORIGINS: 'https://app.example.com',
};

describe('config — production boot validation', () => {
  it('passes with a complete production env', () => {
    expect(collectConfigIssues({ ...PROD_BASE } as NodeJS.ProcessEnv)).toEqual([]);
    expect(() => assertBootConfig({ ...PROD_BASE } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('refuses to boot when auth, db, redis, video secret, or CORS are missing', () => {
    for (const key of ['MONGODB_URI', 'CLERK_SECRET_KEY', 'REDIS_URL', 'VIDEO_SECRET'] as const) {
      const env = { ...PROD_BASE };
      delete (env as Record<string, string | undefined>)[key];
      const issues = collectConfigIssues(env as NodeJS.ProcessEnv);
      expect(issues.some((i) => i.key === key)).toBe(true);
    }
    const noCors = { ...PROD_BASE };
    delete (noCors as Record<string, string | undefined>).CORS_ORIGINS;
    expect(collectConfigIssues(noCors as NodeJS.ProcessEnv).some((i) => i.key === 'CORS_ORIGINS')).toBe(true);
  });

  it('rejects short VIDEO_SECRET and partial Stripe/R2 config', () => {
    const short = collectConfigIssues({ ...PROD_BASE, VIDEO_SECRET: 'short' } as NodeJS.ProcessEnv);
    expect(short.some((i) => i.key === 'VIDEO_SECRET')).toBe(true);

    const stripe = collectConfigIssues({
      ...PROD_BASE,
      STRIPE_SECRET_KEY: 'sk_test_xxxxxxxxxxxxxxxx',
    } as NodeJS.ProcessEnv);
    expect(stripe.some((i) => i.key === 'STRIPE_WEBHOOK_SECRET')).toBe(true);

    const r2 = collectConfigIssues({
      ...PROD_BASE,
      R2_ENDPOINT: 'https://x.r2.cloudflarestorage.com',
      R2_BUCKET: 'b',
    } as NodeJS.ProcessEnv);
    expect(r2.length).toBeGreaterThan(0);
  });

  it('is lenient outside production (local dev stays unblocked)', () => {
    expect(collectConfigIssues({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toEqual([]);
    expect(collectConfigIssues({} as NodeJS.ProcessEnv)).toEqual([]);
  });
});

describe('config — fail-closed degradation defaults', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('dev auth bypass can never activate in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
    expect(devAuthBypassEnabled()).toBe(false);
  });

  it('quota degradation is fail-closed in production even when asked to fail open', () => {
    process.env.NODE_ENV = 'production';
    process.env.QUOTA_FAIL_OPEN = 'true';
    expect(quotaFailOpen()).toBe(false);
  });

  it('throttle defaults to fail-closed in production, fail-open elsewhere', () => {
    delete process.env.THROTTLE_FAIL_CLOSED;
    process.env.NODE_ENV = 'production';
    expect(throttleFailClosed()).toBe(true);
    process.env.NODE_ENV = 'test';
    expect(throttleFailClosed()).toBe(false);
  });
});
