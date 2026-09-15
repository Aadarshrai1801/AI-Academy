/**
 * Atomic Redis counter scripts (Lua/EVAL).
 *
 * Why: INCR/EXPIRE issued as two round-trips are not atomic. A crash or lost
 * connection between them leaves a counter key with NO TTL — a quota or
 * rate-limit key that never expires permanently locks that user out until an
 * operator deletes the key manually. These scripts make the counter + TTL one
 * atomic operation, and make quota consumption roll back when the limit is
 * exceeded (no phantom charges on concurrent over-limit requests).
 *
 * All keys embed their period (window start / day / month), so refreshing the
 * TTL on every call never extends a counter beyond its natural period.
 */

/** INCRBY + EXPIRE atomically. ARGV: [amount, ttlSeconds]. Returns new count. */
export const INCR_WITH_TTL = `
local v = redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return v
`;

/**
 * Atomic quota consumption with limit enforcement:
 * INCRBY, set TTL, and if the result exceeds the limit roll the increment
 * back and report denial. ARGV: [amount, ttlSeconds, limit].
 * Returns { used, allowed(0|1) } where `used` is clamped to the limit.
 */
export const CONSUME_LIMITED = `
local v = redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
local limit = tonumber(ARGV[3])
if v > limit then
  redis.call('DECRBY', KEYS[1], ARGV[1])
  return {v - tonumber(ARGV[1]), 0}
end
return {v, 1}
`;

/** DECRBY clamped at zero (quota refunds must never make counters negative). */
export const DECR_FLOOR_ZERO = `
local v = redis.call('DECRBY', KEYS[1], ARGV[1])
if v < 0 then
  redis.call('SET', KEYS[1], 0)
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return 0
end
return v
`;

/** Typed EVAL helpers (ioredis returns unknown). */
export interface EvalClient {
  eval: (script: string, numkeys: number, ...args: Array<string | number>) => Promise<unknown>;
}

export async function evalIncrWithTtl(
  redis: EvalClient,
  key: string,
  amount: number,
  ttlSeconds: number,
): Promise<number> {
  return Number(await redis.eval(INCR_WITH_TTL, 1, key, amount, ttlSeconds));
}

export async function evalConsumeLimited(
  redis: EvalClient,
  key: string,
  amount: number,
  ttlSeconds: number,
  limit: number,
): Promise<{ used: number; allowed: boolean }> {
  const [used, allowed] = (await redis.eval(
    CONSUME_LIMITED,
    1,
    key,
    amount,
    ttlSeconds,
    limit,
  )) as [number | string, number | string];
  return { used: Number(used), allowed: Number(allowed) === 1 };
}

export async function evalDecrFloorZero(
  redis: EvalClient,
  key: string,
  amount: number,
  ttlSeconds: number,
): Promise<number> {
  return Number(await redis.eval(DECR_FLOOR_ZERO, 1, key, amount, ttlSeconds));
}