import { HttpException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service.js';
import { CONSUME_LIMITED, DECR_FLOOR_ZERO, INCR_WITH_TTL } from './redis-lua.js';

/**
 * Fake Redis whose `eval` mirrors the semantics of the three Lua scripts
 * (the scripts themselves are validated against real Redis by redis-lua.spec,
 * which runs in CI where a Redis service container exists).
 */
class FakeRedis {
  store = new Map<string, string>();
  failEval = false;

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode?: string, _ttl?: number): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async eval(
    script: string,
    _numKeys: number,
    key: string,
    ...args: Array<string | number>
  ): Promise<unknown> {
    if (this.failEval) throw new Error('redis down');
    if (script === INCR_WITH_TTL) {
      const v = Number(this.store.get(key) ?? 0) + Number(args[0]);
      this.store.set(key, String(v));
      return v;
    }
    if (script === CONSUME_LIMITED) {
      const amount = Number(args[0]);
      const limit = Number(args[2]);
      let v = Number(this.store.get(key) ?? 0) + amount;
      if (v > limit) {
        v -= amount; // rollback
        this.store.set(key, String(v));
        return [v, 0];
      }
      this.store.set(key, String(v));
      return [v, 1];
    }
    if (script === DECR_FLOOR_ZERO) {
      const v = Number(this.store.get(key) ?? 0) - Number(args[0]);
      if (v < 0) {
        this.store.set(key, '0');
        return 0;
      }
      this.store.set(key, String(v));
      return v;
    }
    throw new Error('unexpected script');
  }
}

/** Fake QuotaUsage model recording upserts and serving seeded ledger rows. */
class FakeUsageModel {
  docs = new Map<string, { used: number }>();
  writes: Array<{ delta: number; key: string }> = [];

  private rowKey(f: { user_id: string; feature: string; period: string }): string {
    return `${f.user_id}|${f.feature}|${f.period}`;
  }

  findOne(filter: { user_id: string; feature: string; period: string }) {
    const doc = this.docs.get(this.rowKey(filter));
    return {
      lean: () => ({ exec: async () => (doc ? { used: doc.used } : null) }),
    };
  }

  findOneAndUpdate(
    filter: { user_id: string; feature: string; period: string },
    update: { $inc: { used: number } },
  ) {
    const key = this.rowKey(filter);
    const cur = this.docs.get(key) ?? { used: 0 };
    cur.used += update.$inc.used;
    this.docs.set(key, cur);
    this.writes.push({ delta: update.$inc.used, key });
    return { exec: async () => cur };
  }
}

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('EntitlementsService — strict quota gating', () => {
  const savedEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
  });

  it('consumeOrThrow passes silently while under the limit', async () => {
    const svc = new EntitlementsService(new FakeRedis() as never);
    await expect(svc.consumeOrThrow('u1', 'free', 'practice_questions')).resolves.toBeUndefined();
  });

  it('consumeOrThrow throws the exact 429 paywall contract once exhausted', async () => {
    const redis = new FakeRedis();
    redis.store.set(`quota:u1:${new Date().toISOString().slice(0, 10)}:practice_questions`, '10');
    const svc = new EntitlementsService(redis as never);
    let caught: unknown;
    try {
      await svc.consumeOrThrow('u1', 'free', 'practice_questions');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpException);
    const res = (caught as HttpException).getResponse() as Record<string, unknown>;
    expect(res.statusCode).toBe(429);
    expect(res.error).toBe('Quota exhausted');
    expect(res.feature).toBe('practice_questions');
    expect(res.limit).toBe(10);
    expect(typeof res.resetAt).toBe('string');
    // The denied increment was rolled back — no phantom charge.
    expect(redis.store.get(`quota:u1:${new Date().toISOString().slice(0, 10)}:practice_questions`)).toBe('10');
  });
});

describe('EntitlementsService — durable quota ledger', () => {
  const savedEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
  });

  it('rehydrates the Redis counter from the ledger after a Redis flush', async () => {
    const redis = new FakeRedis();
    const ledger = new FakeUsageModel();
    const period = new Date().toISOString().slice(0, 10);
    ledger.docs.set(`u1|practice_questions|${period}`, { used: 7 });
    const svc = new EntitlementsService(redis as never, ledger as never);

    const state = await svc.check('u1', 'free', 'practice_questions');
    expect(state).toEqual({ allowed: true, remaining: 3, limit: 10 });
    // Redis was re-seeded so subsequent consumes start from 7, not 0.
    expect(redis.store.get(`quota:u1:${period}:practice_questions`)).toBe('7');
    await expect(svc.consumeOrThrow('u1', 'free', 'practice_questions')).resolves.toBeUndefined();
    expect(redis.store.get(`quota:u1:${period}:practice_questions`)).toBe('8');
  });

  it('persists allowed consumption and refunds to the ledger', async () => {
    const ledger = new FakeUsageModel();
    const svc = new EntitlementsService(new FakeRedis() as never, ledger as never);

    await svc.consume('u1', 'free', 'ai_text', 2);
    await flush();
    expect(ledger.writes.some((w) => w.delta === 2 && w.key.includes('ai_text'))).toBe(true);

    await svc.refund('u1', 'ai_text', 1);
    await flush();
    expect(ledger.writes.some((w) => w.delta === -1 && w.key.includes('ai_text'))).toBe(true);
  });

  it('denied consumption is never persisted (no phantom charges)', async () => {
    const redis = new FakeRedis();
    const ledger = new FakeUsageModel();
    const svc = new EntitlementsService(redis as never, ledger as never);
    // Fill the free ai_text quota (5).
    for (let i = 0; i < 5; i++) await svc.consume('u2', 'free', 'ai_text');
    ledger.writes.length = 0;
    const res = await svc.consume('u2', 'free', 'ai_text');
    expect(res.allowed).toBe(false);
    await flush();
    expect(ledger.writes).toEqual([]);
  });

  it('record() keeps retroactive usage accounting even when Redis is down', async () => {
    const redis = new FakeRedis();
    redis.failEval = true;
    const ledger = new FakeUsageModel();
    const svc = new EntitlementsService(redis as never, ledger as never);

    await svc.record('u3', 'call_minutes', 12);
    await flush();
    expect(ledger.writes).toEqual([{ delta: 12, key: expect.stringContaining('call_minutes') }]);
  });

  it('persists usage to the ledger even without Redis (accounting-only mode)', async () => {
    const ledger = new FakeUsageModel();
    const svc = new EntitlementsService(null, ledger as never);
    await svc.record('u4', 'call_minutes', 5);
    await flush();
    expect(ledger.writes).toEqual([{ delta: 5, key: expect.stringContaining('call_minutes') }]);
  });
});

describe('EntitlementsService — Redis outage policy', () => {
  const savedEnv = process.env.NODE_ENV;
  const savedFailOpen = process.env.QUOTA_FAIL_OPEN;
  beforeEach(() => delete process.env.QUOTA_FAIL_OPEN);
  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
    if (savedFailOpen === undefined) delete process.env.QUOTA_FAIL_OPEN;
    else process.env.QUOTA_FAIL_OPEN = savedFailOpen;
  });

  it('fails closed with 503 in production when Redis errors', async () => {
    process.env.NODE_ENV = 'production';
    const redis = new FakeRedis();
    redis.failEval = true;
    const svc = new EntitlementsService(redis as never);
    let status: number | undefined;
    try {
      await svc.consume('u1', 'free', 'practice_questions');
    } catch (e) {
      status = (e as HttpException).getStatus();
    }
    expect(status).toBe(503);
  });

  it('fails open outside production to keep local dev working', async () => {
    const redis = new FakeRedis();
    redis.failEval = true;
    const svc = new EntitlementsService(redis as never);
    const state = await svc.consume('u1', 'free', 'practice_questions');
    expect(state.allowed).toBe(true);
  });
});