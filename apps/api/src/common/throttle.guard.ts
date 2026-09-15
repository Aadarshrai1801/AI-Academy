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
import { envInt } from '../config.js';
import { evalIncrWithTtl } from './redis-lua.js';
import { incCounter } from './metrics.js';

/**
 * Global abuse throttle (spec §5.2 edge layer): fixed-window per minute,
 * keyed by authed user or IP. Redis-backed with in-memory fallback so the
 * API stays protected even without Redis (single-instance dev).
 *
 * - Window and TTL are both 60s: a 120s TTL on a 60s key would let a client
 *   accumulate up to 2 minutes' worth of requests across the window boundary.
 * - 429 responses carry `Retry-After` plus `X-RateLimit-*` headers so clients
 *   (and the web app) can back off correctly.
 * - Monitoring (/health) opts out via @SkipThrottle.
 */
const WINDOW_SEC = 60;

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly mem = new Map<string, { n: number; reset: number }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
  ) {}

  private limit() {
    return envInt('RATE_LIMIT_PER_MIN', 120);
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
    const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SEC) * WINDOW_SEC;
    const key = `rl:${windowStart}:${who}`;
    const limit = this.limit();
    const resetAt = (windowStart + WINDOW_SEC) * 1000;

    const reject = (remaining: number) => {
      if (res && !res.headersSent) {
        res.setHeader('Retry-After', String(WINDOW_SEC));
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      }
      throw new HttpException(
        { statusCode: 429, error: 'Too many requests', limit, feature: 'global_rate', resetAt },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    };

    let used: number;
    const memIncr = () => {
      const entry = this.mem.get(key);
      const count = entry && entry.reset === windowStart ? entry.n + 1 : 1;
      this.mem.set(key, { n: count, reset: windowStart });
      if (this.mem.size > 10_000) {
        for (const [k, v] of this.mem) if (v.reset < windowStart) this.mem.delete(k);
      }
      return count;
    };

    if (this.redis) {
      try {
        // Atomic INCR + EXPIRE (Lua): two separate round-trips could leave a
        // TTL-less key on a mid-flight crash, permanently locking the user/IP
        // out of the API until manual cleanup.
        used = await evalIncrWithTtl(this.redis, key, 1, WINDOW_SEC);
      } catch {
        // Redis outage: fall back to per-instance counting instead of failing
        // every request or (worse) allowing unlimited traffic. NOTE: with N
        // replicas the effective limit becomes N× configured — treat this
        // metric as a page-worthy alert in multi-instance deployments.
        incCounter('api_redis_failures_total', { component: 'throttle' });
        used = memIncr();
      }
    } else {
      used = memIncr();
    }

    if (used > limit) reject(0);
    if (res && !res.headersSent) {
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - used)));
    }
    return true;
  }
}
