import { Redis } from 'ioredis';
import {
  evalConsumeLimited,
  evalDecrFloorZero,
  evalIncrWithTtl,
  evalSlidingWindow,
} from './redis-lua.js';

/**
 * Integration tests for the atomic Redis counter scripts. These REQUIRE a real
 * Redis (CI provides one as a service container); locally they are skipped
 * when Redis is unreachable so `npm test` stays hermetic.
 */
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
redis.on('error', () => undefined);

let available = false;
try {
  await redis.connect();
  available = (await redis.ping()) === 'PONG';
} catch {
  available = false;
}

afterAll(async () => {
  await redis.quit().catch(() => undefined);
});

const d = available ? describe : describe.skip;

d('redis atomic counter scripts', () => {
  const key = () => `spec:lua:${Date.now()}-${Math.random().toString(36).slice(2)}`;

  it('INCR_WITH_TTL increments and always carries a TTL (no orphan keys)', async () => {
    const k = key();
    expect(await evalIncrWithTtl(redis, k, 1, 60)).toBe(1);
    expect(await evalIncrWithTtl(redis, k, 1, 60)).toBe(2);
    const pttl = await redis.pttl(k);
    expect(pttl).toBeGreaterThan(0);
  });

  it('CONSUME_LIMITED allows up to the limit and rolls back over-limit increments', async () => {
    const k = key();
    // limit 3
    expect(await evalConsumeLimited(redis, k, 1, 60, 3)).toEqual({ used: 1, allowed: true });
    expect(await evalConsumeLimited(redis, k, 1, 60, 3)).toEqual({ used: 2, allowed: true });
    expect(await evalConsumeLimited(redis, k, 1, 60, 3)).toEqual({ used: 3, allowed: true });
    // Over limit: denied AND the increment is rolled back — no phantom charge.
    expect(await evalConsumeLimited(redis, k, 1, 60, 3)).toEqual({ used: 3, allowed: false });
    expect(await redis.get(k)).toBe('3');
    // The key still has a TTL after denials (never locks the user out).
    expect(await redis.pttl(k)).toBeGreaterThan(0);
  });

  it('CONSUME_LIMITED handles multi-unit consumption', async () => {
    const k = key();
    expect(await evalConsumeLimited(redis, k, 5, 60, 15)).toEqual({ used: 5, allowed: true });
    // Over limit: denied, the 15-unit increment is rolled back, and `used`
    // reports the count BEFORE the denied request (5/15 used, remaining 10).
    expect(await evalConsumeLimited(redis, k, 15, 60, 15)).toEqual({ used: 5, allowed: false });
    expect(await redis.get(k)).toBe('5');
  });

  it('DECR_FLOOR_ZERO never produces a negative counter', async () => {
    const k = key();
    await redis.set(k, '1', 'EX', 60);
    expect(await evalDecrFloorZero(redis, k, 5, 60)).toBe(0);
    expect(await redis.get(k)).toBe('0');
    expect(await evalDecrFloorZero(redis, k, 1, 60)).toBe(0);
    expect(await redis.get(k)).toBe('0');
  });

  it('SLIDING_WINDOW admits up to the limit, denies beyond, and carries a TTL', async () => {
    const k = key();
    const now = Date.now();
    expect(await evalSlidingWindow(redis, k, now, 60_000, 3, `${now}-a`)).toEqual({
      used: 1,
      allowed: true,
      retryAfterMs: 0,
    });
    expect(await evalSlidingWindow(redis, k, now, 60_000, 3, `${now}-b`)).toEqual({
      used: 2,
      allowed: true,
      retryAfterMs: 0,
    });
    expect(await evalSlidingWindow(redis, k, now, 60_000, 3, `${now}-c`)).toEqual({
      used: 3,
      allowed: true,
      retryAfterMs: 0,
    });
    const denied = await evalSlidingWindow(redis, k, now, 60_000, 3, `${now}-d`);
    expect(denied.allowed).toBe(false);
    expect(denied.used).toBe(3);
    // Retry-After is derived from the oldest in-window request (~60s here).
    expect(denied.retryAfterMs).toBeGreaterThan(59_000);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(60_000);
    // No orphan keys: the window always expires.
    expect(await redis.pttl(k)).toBeGreaterThan(0);
    expect(await redis.zcard(k)).toBe(3);
  });

  it('SLIDING_WINDOW releases capacity as requests age out', async () => {
    const k = key();
    const now = Date.now();
    for (const m of ['a', 'b']) await evalSlidingWindow(redis, k, now - 61_000, 60_000, 2, `${m}`);
    // Both entries are older than the window → the next request is admitted.
    expect(await evalSlidingWindow(redis, k, now, 60_000, 2, 'c')).toEqual({
      used: 1,
      allowed: true,
      retryAfterMs: 0,
    });
  });
});