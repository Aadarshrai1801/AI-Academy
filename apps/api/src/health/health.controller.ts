import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { SkipThrottle } from '../common/throttle.decorator.js';
import { Public } from '../common/public.decorator.js';
import { appVersion, nodeEnv } from '../config.js';

/**
 * Liveness vs readiness (enterprise deployments):
 * - `/health/live`  — process is up. Never touches dependencies, so a blip in
 *   Mongo must not make an orchestrator kill the pod.
 * - `/health/ready` — dependencies (Mongo + Redis in production) respond.
 *   Returns 503 when not ready so load balancers stop routing traffic.
 * - `/health`       — kept for backward compatibility (Render keep-alive
 *   workflow + existing clients) and mirrors `/health/live`.
 */
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectConnection() @Optional() private readonly connection?: Connection,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis?: Redis | null,
  ) {}

  private base() {
    return {
      status: 'ok',
      service: 'ai-academy-api',
      version: appVersion(),
      env: nodeEnv(),
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  }

  @Get()
  status() {
    return this.base();
  }

  @Get('live')
  live() {
    return this.base();
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    let ready = true;

    if (this.connection) {
      try {
        const started = Date.now();
        await this.connection.db?.admin().ping();
        checks.mongo = { ok: true, detail: `${Date.now() - started}ms` };
      } catch (err) {
        ready = false;
        checks.mongo = { ok: false, detail: (err as Error).message.slice(0, 120) };
      }
    } else {
      checks.mongo = { ok: false, detail: 'no connection' };
      ready = false;
    }

    // Redis is optional in development (degraded entitlements) and required in
    // production (boot-time config assertion enforces REDIS_URL).
    if (this.redis) {
      try {
        const started = Date.now();
        await this.redis.ping();
        checks.redis = { ok: true, detail: `${Date.now() - started}ms` };
      } catch (err) {
        ready = false;
        checks.redis = { ok: false, detail: (err as Error).message.slice(0, 120) };
      }
    } else {
      checks.redis = { ok: false, detail: 'not configured' };
      if (nodeEnv() === 'production') ready = false;
    }

    const body = { ...this.base(), status: ready ? 'ok' : 'degraded', checks };
    if (!ready) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
