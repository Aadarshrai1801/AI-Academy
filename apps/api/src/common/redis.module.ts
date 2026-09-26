import { Global, Module } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { attachRedisErrorLogging } from './bull-connection.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Fast-fail tuning for the shared (non-BullMQ) Redis client.
 *
 * Why this exists: with ioredis defaults, a command issued while Redis is
 * unreachable is queued and retried across reconnects. The edge throttle
 * calls Redis on EVERY request, so one dead Redis made every route stall
 * 4–18s before its fallback ran — long enough to blow past the web client's
 * 15s AbortSignal and surface as `TimeoutError: signal timed out`.
 *
 * `enableOfflineQueue: false` rejects such commands immediately, so the
 * documented degradation paths run at once: throttle → in-memory fallback
 * (or fast 503 when failing closed), quota → fail open/closed, leaderboard
 * → in-memory board. `commandTimeout` bounds the "socket up but the server
 * never replies" case; `connectTimeout` bounds each reconnect attempt.
 *
 * Do NOT use these options for BullMQ connections — blocking commands rely
 * on the offline queue and `maxRetriesPerRequest: null` (see bull-connection).
 */
export const fastFailRedisOptions = (): RedisOptions => ({
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 3_000,
  commandTimeout: 2_000,
});

/**
 * Create a fast-fail client for an arbitrary Redis URL (TLS SNI handled).
 * Used for the shared client and for short-lived fallback connections that
 * some services open when the shared client is unavailable.
 */
export function newFastFailRedisClient(url: string, scope: string): Redis {
  // Managed proxies (Layerbase/Upstash) route by TLS SNI, which ioredis
  // omits for URL strings — set it explicitly or the server drops us.
  const { hostname, protocol } = new URL(url);
  const client = new Redis(url, {
    ...fastFailRedisOptions(),
    ...(protocol === 'rediss:' ? { tls: { servername: hostname } } : {}),
  });
  // Rate-limited listener: a down Redis emits an error per reconnect attempt;
  // one actionable warning per minute beats a log storm.
  attachRedisErrorLogging(client, scope);
  return client;
}

/**
 * Phase 0: lazy, optional Redis connection.
 * - If REDIS_URL is missing/unreachable, provider yields null and
 *   quota checks degrade to allow (logged) so local dev without Redis works.
 * - Phase 1 switches degradation to deny-or-allow per policy + adds tests.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        const url = process.env.REDIS_URL;
        if (!url) return null;
        const client = newFastFailRedisClient(url, 'shared');
        client.connect().catch(() => undefined);
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
