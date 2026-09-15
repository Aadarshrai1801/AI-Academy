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

/**
 * Sliding-window rate limiter over a ZSET of request timestamps.
 * KEYS[1] = window key · ARGV = [nowMs, windowMs, limit, uniqueMember]
 * Returns { used, allowed(0|1), retryAfterMs }.
 *
 * Why not a fixed window: a fixed window admits up to 2× the limit across a
 * boundary (e.g. 120 requests at 0:59 plus 120 more at 1:00). Counting exact
 * request timestamps holds the limit at every instant and gives an accurate
 * Retry-After derived from the oldest in-window request.
 */
export const SLIDING_WINDOW = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local used = redis.call('ZCARD', KEYS[1])
if used >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] ~= nil then
    retry = (tonumber(oldest[2]) + window) - now
    if retry < 0 then retry = 0 end
  end
  return {used, 0, retry}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {used + 1, 1, 0}
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

export async function evalSlidingWindow(
  redis: EvalClient,
  key: string,
  nowMs: number,
  windowMs: number,
  limit: number,
  member: string,
): Promise<{ used: number; allowed: boolean; retryAfterMs: number }> {
  const [used, allowed, retryAfterMs] = (await redis.eval(
    SLIDING_WINDOW,
    1,
    key,
    nowMs,
    windowMs,
    limit,
    member,
  )) as [number | string, number | string, number | string];
  return {
    used: Number(used),
    allowed: Number(allowed) === 1,
    retryAfterMs: Math.max(0, Number(retryAfterMs)),
  };
}