import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import type { Response } from 'express';
import { REDIS_CLIENT } from './redis.module.js';
import { SKIP_THROTTLE_KEY } from './throttle.decorator.js';
import { envInt, throttleFailClosed } from '../config.js';
import { evalSlidingWindow } from './redis-lua.js';
import { incCounter } from './metrics.js';
import { logWarn } from './json-logger.js';

/**
 * Global abuse throttle (spec §5.2 edge layer), keyed by authed user or IP.
 *
 * - **Sliding window** (ZSET of request timestamps, atomic Lua): a fixed
 *   window would admit up to 2× the limit across a boundary; exact timestamps
 *   hold the limit at every instant and yield an accurate Retry-After.
 * - **Failure policy:** production fails closed (503) when Redis is
 *   unreachable — an outage must not silently disable abuse protection, and
 *   the in-memory fallback counts per instance (N replicas → N× the limit).
 *   Dev/test keep the in-memory fallback so local work is never blocked.
 *   Override with `THROTTLE_FAIL_CLOSED`.
 * - 429s carry `Retry-After` + `X-RateLimit-*` headers so clients back off.
 * - Monitoring (/health, /metrics) opts out via `@SkipThrottle`.
 */
const WINDOW_MS = 60_000;

@Injectable()
export class ThrottleGuard implements CanActivate {
  /** In-memory fallback: request timestamps per key (dev/test, or opt-in). */
  private readonly mem = new Map<string, number[]>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
  ) {}

  private limit() {
    return envInt('RATE_LIMIT_PER_MIN', 120);
  }

  /** Local sliding-window approximation used only when Redis is unavailable. */
  private memSliding(
    key: string,
    now: number,
  ): { used: number; allowed: boolean; retryAfterMs: number } {
    const stamps = (this.mem.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
    if (stamps.length >= this.limit()) {
      this.mem.set(key, stamps);
      return { used: stamps.length, allowed: false, retryAfterMs: stamps[0] + WINDOW_MS - now };
    }
    stamps.push(now);
    this.mem.set(key, stamps);
    if (this.mem.size > 10_000) {
      for (const [k, v] of this.mem) if (v.every((t) => t <= now - WINDOW_MS)) this.mem.delete(k);
    }
    return { used: stamps.length, allowed: true, retryAfterMs: WINDOW_MS };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const res: Response | undefined = context.switchToHttp().getResponse();
    const who = req.auth?.userId ?? req.ip ?? 'anon';
    const limit = this.limit();
    const now = Date.now();
    // No window-start in the key: the window slides with each request.
    const key = `rl:${who}`;

    const setHeaders = (remaining: number, resetAtMs: number) => {
      if (!res || res.headersSent) return;
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAtMs / 1000)));
    };

    let used: number;
    let allowed: boolean;
    let retryAfterMs = WINDOW_MS;

    if (this.redis) {
      try {
        const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
        const result = await evalSlidingWindow(this.redis, key, now, WINDOW_MS, limit, member);
        used = result.used;
        allowed = result.allowed;
        if (result.retryAfterMs > 0) retryAfterMs = result.retryAfterMs;
      } catch (err) {
        incCounter('api_redis_failures_total', { component: 'throttle' });
        if (throttleFailClosed()) {
          // Fail closed: no abuse protection must never mean unlimited traffic.
          incCounter('api_throttle_unavailable_total');
          logWarn('rate limiting unavailable — failing closed', {
            error: err instanceof Error ? err.message : String(err),
          });
          throw new HttpException(
            { statusCode: 503, error: 'Rate limiting temporarily unavailable — please retry shortly' },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        const local = this.memSliding(key, now);
        used = local.used;
        allowed = local.allowed;
        retryAfterMs = local.retryAfterMs;
      }
    } else {
      const local = this.memSliding(key, now);
      used = local.used;
      allowed = local.allowed;
      retryAfterMs = local.retryAfterMs;
    }

    if (!allowed) {
      const resetAt = now + Math.max(1, retryAfterMs);
      if (res && !res.headersSent) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      }
      setHeaders(0, resetAt);
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too many requests',
          limit,
          feature: 'global_rate',
          resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    setHeaders(limit - used, now + WINDOW_MS);
    return true;
  }
}
