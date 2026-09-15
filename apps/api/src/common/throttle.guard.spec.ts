import { HttpException } from '@nestjs/common';
import { ThrottleGuard } from './throttle.guard.js';
import { SLIDING_WINDOW } from './redis-lua.js';
import { renderMetrics, resetMetricsForTest } from './metrics.js';

/** Fake Redis whose eval mirrors the SLIDING_WINDOW Lua semantics. */
class FakeRedis {
  windows = new Map<string, Array<{ score: number }>>();
  failEval = false;

  async eval(
    script: string,
    _numKeys: number,
    key: string,
    ...args: Array<string | number>
  ): Promise<unknown> {
    if (this.failEval) throw new Error('redis down');
    if (script !== SLIDING_WINDOW) throw new Error('unexpected script');
    const now = Number(args[0]);
    const window = Number(args[1]);
    const limit = Number(args[2]);
    const entries = (this.windows.get(key) ?? []).filter((e) => e.score > now - window);
    if (entries.length >= limit) {
      this.windows.set(key, entries);
      return [entries.length, 0, Math.max(0, entries[0].score + window - now)];
    }
    entries.push({ score: now });
    this.windows.set(key, entries);
    return [entries.length, 1, 0];
  }
}

const reflectorStub = (skip: boolean) =>
  ({ getAllAndOverride: () => (skip ? true : undefined) }) as never;

const makeContext = (opts: { ip?: string; userId?: string } = {}) => {
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  };
  const req = { ip: opts.ip ?? '1.2.3.4', auth: opts.userId ? { userId: opts.userId } : undefined };
  const ctx = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  };
  return { ctx, headers };
};

const guard = (redis: unknown, skip = false) => new ThrottleGuard(reflectorStub(skip), redis as never);

describe('ThrottleGuard — sliding window', () => {
  const savedEnv = process.env.NODE_ENV;
  const savedRate = process.env.RATE_LIMIT_PER_MIN;
  const savedFailClosed = process.env.THROTTLE_FAIL_CLOSED;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_PER_MIN = '3';
    delete process.env.THROTTLE_FAIL_CLOSED;
    resetMetricsForTest();
  });
  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
    if (savedRate === undefined) delete process.env.RATE_LIMIT_PER_MIN;
    else process.env.RATE_LIMIT_PER_MIN = savedRate;
    if (savedFailClosed === undefined) delete process.env.THROTTLE_FAIL_CLOSED;
    else process.env.THROTTLE_FAIL_CLOSED = savedFailClosed;
    vi.useRealTimers();
  });

  it('allows up to the limit and sets rate-limit headers', async () => {
    const g = guard(new FakeRedis());
    const { ctx, headers } = makeContext();
    for (let i = 0; i < 3; i++) {
      await expect(g.canActivate(ctx as never)).resolves.toBe(true);
    }
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['X-RateLimit-Reset']).toBeTruthy();
  });

  it('rejects over-limit requests with 429 + Retry-After', async () => {
    const g = guard(new FakeRedis());
    const { ctx, headers } = makeContext();
    for (let i = 0; i < 3; i++) await g.canActivate(ctx as never);

    let caught: unknown;
    try {
      await g.canActivate(ctx as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpException);
    const payload = (caught as HttpException).getResponse() as Record<string, unknown>;
    expect(payload.statusCode).toBe(429);
    expect(payload.feature).toBe('global_rate');
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('frees capacity once requests age out of the window (no boundary burst)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const g = guard(new FakeRedis());
    const { ctx } = makeContext();
    for (let i = 0; i < 3; i++) await g.canActivate(ctx as never);
    await expect(g.canActivate(ctx as never)).rejects.toThrow(HttpException);

    // 61s later the earlier requests have slid out — the limit resets.
    vi.setSystemTime(new Date('2026-01-01T00:01:01.000Z'));
    await expect(g.canActivate(ctx as never)).resolves.toBe(true);
  });

  it('keys buckets per authenticated user (not shared across users)', async () => {
    const g = guard(new FakeRedis());
    for (let i = 0; i < 3; i++) await g.canActivate(makeContext({ userId: 'u1' }).ctx as never);
    // A different user still has full quota from the same IP.
    await expect(g.canActivate(makeContext({ userId: 'u2' }).ctx as never)).resolves.toBe(true);
  });

  it('honours @SkipThrottle without touching Redis', async () => {
    const redis = new FakeRedis();
    redis.failEval = true;
    await expect(guard(redis, true).canActivate(makeContext().ctx as never)).resolves.toBe(true);
  });

  it('fails closed (503) in production when Redis is unreachable', async () => {
    process.env.NODE_ENV = 'production';
    const redis = new FakeRedis();
    redis.failEval = true;
    let status: number | undefined;
    try {
      await guard(redis).canActivate(makeContext().ctx as never);
    } catch (e) {
      status = (e as HttpException).getStatus();
    }
    expect(status).toBe(503);
    expect(renderMetrics()).toContain('api_throttle_unavailable_total');
  });

  it('degrades to the in-memory window outside production', async () => {
    const redis = new FakeRedis();
    redis.failEval = true;
    const g = guard(redis);
    await expect(g.canActivate(makeContext().ctx as never)).resolves.toBe(true);
    expect(renderMetrics()).toContain('api_redis_failures_total{component="throttle"}');
  });

  it('enforces the limit in-memory when no Redis is configured at all', async () => {
    const g = guard(null);
    const { ctx } = makeContext();
    for (let i = 0; i < 3; i++) await g.canActivate(ctx as never);
    await expect(g.canActivate(ctx as never)).rejects.toThrow(HttpException);
  });

  it('honours explicit THROTTLE_FAIL_CLOSED overrides in any env', async () => {
    process.env.NODE_ENV = 'production';
    process.env.THROTTLE_FAIL_CLOSED = 'false';
    const redis = new FakeRedis();
    redis.failEval = true;
    await expect(guard(redis).canActivate(makeContext().ctx as never)).resolves.toBe(true);

    process.env.NODE_ENV = 'test';
    process.env.THROTTLE_FAIL_CLOSED = 'true';
    const redis2 = new FakeRedis();
    redis2.failEval = true;
    await expect(guard(redis2).canActivate(makeContext().ctx as never)).rejects.toThrow(HttpException);
  });
});