import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module.js';
import { SKIP_THROTTLE_KEY } from './throttle.decorator.js';

/**
 * Global abuse throttle (spec §5.2 edge layer): fixed-window per minute,
 * keyed by authed user or IP. Redis-backed with in-memory fallback so the
 * API stays protected even without Redis (single-instance dev).
 * Monitoring (/health) opts out via @SkipThrottle.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly mem = new Map<string, { n: number; reset: number }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
  ) {}

  private limit() {
    const v = Number(process.env.RATE_LIMIT_PER_MIN);
    return Number.isFinite(v) && v > 0 ? v : 120;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const who = req.auth?.userId ?? req.ip ?? 'anon';
    const key = `rl:${new Date().toISOString().slice(0, 16)}:${who}`;
    const limit = this.limit();

    if (this.redis) {
      const used = await this.redis.incr(key);
      if (used === 1) await this.redis.expire(key, 120);
      if (used > limit) {
        throw new HttpException(
          { statusCode: 429, error: 'Too many requests', limit, feature: 'global_rate' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    }

    const now = Date.now();
    const slot = Math.floor(now / 60000);
    const entry = this.mem.get(key);
    const count = entry && entry.reset === slot ? entry.n + 1 : 1;
    this.mem.set(key, { n: count, reset: slot });
    if (this.mem.size > 10000) {
      for (const [k, v] of this.mem) if (v.reset < slot) this.mem.delete(k);
    }
    if (count > limit) {
      throw new HttpException(
        { statusCode: 429, error: 'Too many requests', limit, feature: 'global_rate' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
