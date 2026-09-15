import { IdempotencyMiddleware } from './idempotency.middleware.js';

/** Minimal Redis stand-in covering the middleware's get/set(NX)/del usage. */
class FakeRedis {
  store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, _mode?: string, _ttl?: number, nx?: string): Promise<'OK' | null> {
    if (nx === 'NX') {
      if (this.store.has(key)) return null;
      this.store.set(key, value);
      return 'OK';
    }
    this.store.set(key, value);
    return 'OK';
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

interface Ctx {
  nextCalled: boolean;
  res: {
    statusCode: number;
    header: Record<string, string>;
    setHeader: (k: string, v: string) => void;
    status: (c: number) => unknown;
    json: (body: unknown) => unknown;
  };
  captured?: { status: number; body: unknown };
}

function makeRes(ctx: Ctx): Ctx['res'] {
  const res = {
    statusCode: 200,
    header: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      res.header[k] = v;
    },
    status(c: number) {
      res.statusCode = c;
      return res;
    },
    json(body: unknown) {
      ctx.captured = { status: res.statusCode, body };
      return res;
    },
  };
  return res;
}

function makeReq(method: string, idemKey?: string) {
  return {
    method,
    headers: idemKey ? { 'idempotency-key': idemKey } : {},
  } as never;
}

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('IdempotencyMiddleware', () => {
  const setup = (redis: FakeRedis | null) => {
    const ctx: Ctx = { nextCalled: false, res: null as never };
    const mw = new IdempotencyMiddleware(redis as never);
    // Simulates a downstream handler: respond with { ok: true } when invoked.
    const next = () => {
      ctx.nextCalled = true;
      ctx.res.json({ ok: true });
    };
    return { ctx, mw, next };
  };

  it('claims the key, passes through, and caches the response', async () => {
    const redis = new FakeRedis();
    const { ctx, mw, next } = setup(redis);
    ctx.res = makeRes(ctx);
    mw.use(makeReq('POST', 'k1'), ctx.res as never, next);
    await flush();
    expect(ctx.nextCalled).toBe(true);
    expect(ctx.captured).toEqual({ status: 200, body: { ok: true } });
    const cached = JSON.parse(redis.store.get('idem:k1')!);
    expect(cached).toEqual({ status: 200, body: { ok: true } });
    expect(redis.store.has('idem:k1:lock')).toBe(false);
  });

  it('replays the cached response for a repeated key without re-running the handler', async () => {
    const redis = new FakeRedis();
    redis.store.set('idem:k2', JSON.stringify({ status: 201, body: { attemptId: 'a1' } }));
    const { ctx, mw, next } = setup(redis);
    ctx.res = makeRes(ctx);
    mw.use(makeReq('POST', 'k2'), ctx.res as never, next);
    await flush();
    expect(ctx.nextCalled).toBe(false);
    expect(ctx.captured).toEqual({ status: 201, body: { attemptId: 'a1' } });
    expect(ctx.res.header['Idempotency-Replayed']).toBe('true');
  });

  it('rejects a concurrent duplicate with 409 while the first is in flight', async () => {
    const redis = new FakeRedis();
    redis.store.set('idem:k3:lock', '1');
    const { ctx, mw, next } = setup(redis);
    ctx.res = makeRes(ctx);
    mw.use(makeReq('POST', 'k3'), ctx.res as never, next);
    await flush();
    expect(ctx.nextCalled).toBe(false);
    expect(ctx.captured).toEqual({
      status: 409,
      body: { statusCode: 409, error: 'A request with this Idempotency-Key is still in progress' },
    });
  });

  it('passes through requests without the header, non-POSTs, and Redis-less deployments', async () => {
    for (const [redis, req] of [
      [new FakeRedis(), makeReq('POST', undefined)],
      [new FakeRedis(), makeReq('GET', 'k4')],
      [null, makeReq('POST', 'k5')],
    ] as const) {
      const { ctx, mw, next } = setup(redis);
      ctx.res = makeRes(ctx);
      mw.use(req, ctx.res as never, next);
      await flush();
      // Handler ran normally; nothing was cached.
      expect(ctx.nextCalled).toBe(true);
      expect(ctx.captured).toEqual({ status: 200, body: { ok: true } });
      if (redis) expect(redis.store.has('idem:k5')).toBe(false);
    }
  });
});