import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module.js';

/**
 * Server-side enforcement of the `Idempotency-Key` header.
 *
 * The web client already generates and sends this header on non-idempotent
 * POSTs (attempts, checkout, AI requests) so a retried/timed-out request never
 * duplicates work — but until now nothing on the API read it. This middleware:
 *
 * - Replays the cached response for a completed request (24h TTL) with an
 *   `Idempotency-Replayed: true` header — the client gets the original result
 *   instead of a duplicate charge/attempt.
 * - Rejects a concurrent duplicate (409) while the first is still in flight.
 * - Fails open when Redis is unavailable or the header is absent (the header
 *   is advisory for clients that don't send it).
 */
const RESPONSE_TTL_SEC = 24 * 3600;
const LOCK_TTL_MS = 60_000;

interface CachedResponse {
  status: number;
  body: unknown;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Idempotency');

  constructor(@Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['idempotency-key'];
    if (
      !this.redis ||
      req.method !== 'POST' ||
      typeof header !== 'string' ||
      header.length === 0 ||
      header.length > 200
    ) {
      next();
      return;
    }

    const redis = this.redis;
    const key = `idem:${header}`;
    const lockKey = `${key}:lock`;

    const failOpen = (err: unknown) => {
      this.logger.warn(`redis unavailable — idempotency skipped (${(err as Error).message})`);
      next();
    };

    redis
      .get(key)
      .then((raw) => {
        if (raw) {
          const cached = JSON.parse(raw) as CachedResponse;
          res.setHeader('Idempotency-Replayed', 'true');
          res.status(cached.status).json(cached.body);
          return;
        }
        return redis
          .set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX')
          .then((claimed) => {
            if (claimed !== 'OK') {
              res.status(409).json({
                statusCode: 409,
                error: 'A request with this Idempotency-Key is still in progress',
              });
              return;
            }
            // Capture the response body once it is serialized so a retry of
            // the same key replays the exact original result.
            const origJson = res.json.bind(res);
            res.json = (body: unknown) => {
              void Promise.all([
                redis.set(key, JSON.stringify({ status: res.statusCode, body }), 'EX', RESPONSE_TTL_SEC),
                redis.del(lockKey),
              ]).catch(() => undefined);
              return origJson(body);
            };
            next();
          })
          .catch(failOpen);
      })
      .catch(failOpen);
  }
}