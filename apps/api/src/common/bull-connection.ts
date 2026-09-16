import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { envBool, envInt } from '../config.js';

/**
 * Shared BullMQ connection factory.
 *
 * Why this exists: ioredis emits `error` events for every failed command and,
 * with `maxRetriesPerRequest: null` (required by BullMQ), also retries forever.
 * On a metered Redis (Upstash free tier) an exhausted quota produced a storm of
 * `ERR max requests limit exceeded` stack traces — one per retry, per queue —
 * that drowned the runtime logs. A listener plus a rate-limited log converts
 * that into a single actionable warning per minute while the rest of the API
 * keeps degrading gracefully.
 *
 * Trade-off: BullMQ's own polling (stalled checks, drain polls, heartbeats)
 * costs commands even when idle. `stalledInterval`/`drainDelay` are tuned for
 * low-traffic deployments; set REDIS_COMMAND_BUDGET_GUARD=false to restore
 * BullMQ defaults.
 */
const log = new Logger('Redis');

const defaultOptions = (): RedisOptions => ({
  // BullMQ requires null so commands queue across reconnects.
  maxRetriesPerRequest: null,
  // Serverless Redis (Upstash) does not answer INFO/CLIENT probes reliably.
  enableReadyCheck: false,
  // Bound reconnect backoff: default ioredis retries every 50ms..2s forever,
  // which multiplies metered usage during an outage.
  retryStrategy: (times: number) => Math.min(times * 500 + 500, 30_000),
  connectTimeout: 10_000,
});

/**
 * Create a dedicated Redis connection for a BullMQ Queue/Worker.
 * Never share the app's shared client — BullMQ owns blocking commands.
 */
export function newBullConnection(scope: string, opts: RedisOptions = {}): Redis {
  // Same SNI requirement as the shared client (see redis.module.ts).
  const { hostname, protocol } = new URL(process.env.REDIS_URL!);
  const client = new Redis(process.env.REDIS_URL!, {
    ...defaultOptions(),
    ...(protocol === 'rediss:' ? { tls: { servername: hostname } } : {}),
    ...opts,
  });
  attachRedisErrorLogging(client, scope);
  return client;
}

const ERROR_LOG_INTERVAL_MS = 60_000;
const lastLogged = new Map<string, number>();

/**
 * Attach a rate-limited `error` listener. Without a listener, ioredis throws
 * unhandled `error` events; with a naive listener, an outage floods the logs.
 */
export function attachRedisErrorLogging(client: Redis, scope: string): void {
  client.on('error', (err: Error) => {
    const now = Date.now();
    const prev = lastLogged.get(scope) ?? 0;
    if (now - prev < ERROR_LOG_INTERVAL_MS) return;
    lastLogged.set(scope, now);
    log.warn(`${scope}: ${err.message}`);
  });
  client.on('reconnecting', () => {
    const now = Date.now();
    const key = `${scope}:reconnect`;
    const prev = lastLogged.get(key) ?? 0;
    if (now - prev < ERROR_LOG_INTERVAL_MS) return;
    lastLogged.set(key, now);
    log.warn(`${scope}: reconnecting to Redis`);
  });
}

/**
 * BullMQ worker tuning options (shared by all three queues).
 * Stalled checks are the main idle cost: the default 30s interval runs a Lua
 * script per worker forever, even with an empty queue.
 */
export function workerTuning(): { stalledInterval: number; drainDelay: number } {
  if (!envBool('REDIS_COMMAND_BUDGET_GUARD', true)) {
    return { stalledInterval: 30_000, drainDelay: 5 };
  }
  return {
    // 2 min instead of 30s: stall recovery is slower, idle cost drops 4x.
    stalledInterval: envInt('REDIS_STALLED_INTERVAL_MS', 120_000),
    // Idle blocking-pop wake-up cycle in seconds (BullMQ default is 5s).
    drainDelay: envInt('REDIS_DRAIN_DELAY_S', 30),
  };
}
