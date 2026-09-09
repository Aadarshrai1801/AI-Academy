import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

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
        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        client.on('error', (err: Error) => {
          // eslint-disable-next-line no-console
          console.warn('[redis] connection error (degraded mode):', err.message);
        });
        client.connect().catch(() => undefined);
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
