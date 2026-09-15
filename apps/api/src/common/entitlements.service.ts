import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module.js';
import { quotaFailOpen } from '../config.js';
import { evalConsumeLimited, evalDecrFloorZero, evalIncrWithTtl } from './redis-lua.js';
import { QuotaUsage, QuotaUsageDocument } from './quota-usage.schema.js';
import { incCounter } from './metrics.js';
import { logWarn } from './json-logger.js';

export type Role = 'free' | 'pro' | 'admin';

/**
 * Central entitlements/quota service (spec §2.7, §5.2, §6.2).
 * Every gated endpoint checks here BEFORE spending budget (LLM, video, SFU).
 *
 * Durability: Redis counters are the hot path, but they are volatile — a
 * flush/failover would reset every Pro user's quota mid-period. Every allowed
 * consumption is written through to the `quota_usage` Mongo ledger, and
 * `check()` re-seeds the Redis counter from that ledger whenever the Redis key
 * is missing (fresh period or Redis loss). Money paths use `consumeOrThrow()`
 * — a single atomic gate right before the spend — so the advisory guard check
 * can no longer be raced.
 */
const DAILY_LIMITS: Record<Role, Record<string, number>> = {
  free: { practice_questions: 10, hard_questions: 2, ai_text: 5, call_minutes: 15 },
  pro: { practice_questions: 500, hard_questions: -1, ai_text: 100, call_minutes: -1 },
  admin: { practice_questions: -1, hard_questions: -1, ai_text: -1, call_minutes: -1 },
};

const MONTHLY_LIMITS: Record<Role, Record<string, number>> = {
  free: { ai_video: 2 },
  pro: { ai_video: 20 },
  admin: { ai_video: -1 },
};

@Injectable()
export class EntitlementsService {
  /** Warn at most once per minute about ledger persistence failures. */
  private lastPersistWarn = 0;

  constructor(
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
    @Optional() @InjectModel(QuotaUsage.name)
    private readonly usage?: Model<QuotaUsageDocument> | null,
  ) {}

  /** 'YYYY-MM-DD' (daily) or 'YYYY-MM' (monthly) — mirrors the Redis key. */
  private periodKey(feature: string): string {
    return this.isMonthly(feature)
      ? new Date().toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 10);
  }

  private keyFor(userId: string, feature: string): string {
    return `quota:${userId}:${this.periodKey(feature)}:${feature}`;
  }

  private ttlFor(feature: string): number {
    return this.isMonthly(feature) ? 31 * 86400 : 86400;
  }

  /**
   * Re-seed the Redis counter from the durable Mongo ledger when the Redis key
   * is missing (fresh period or Redis flush/failover). Best-effort: a Mongo
   * outage must never break quota checks — we just fall back to the counter.
   */
  private async rehydrate(userId: string, feature: string): Promise<number> {
    if (!this.redis || !this.usage) return 0;
    try {
      const doc = (await this.usage
        .findOne({ user_id: userId, feature, period: this.periodKey(feature) })
        .lean()
        .exec()) as { used?: number } | null;
      const used = Math.max(0, doc?.used ?? 0);
      if (used > 0) {
        await this.redis.set(this.keyFor(userId, feature), String(used), 'EX', this.ttlFor(feature));
        return used;
      }
    } catch {
      /* ledger unavailable — volatile counters only */
    }
    return 0;
  }

  /** Fire-and-forget write-through to the durable ledger. Never throws. */
  private persist(userId: string, feature: string, delta: number): void {
    if (!this.usage) return;
    void this.usage
      .findOneAndUpdate(
        { user_id: userId, feature, period: this.periodKey(feature) },
        { $inc: { used: delta }, $set: { updated_at: new Date() } },
        { upsert: true },
      )
      .exec()
      .catch(() => {
        const now = Date.now();
        if (now - this.lastPersistWarn > 60_000) {
          this.lastPersistWarn = now;
          logWarn('quota ledger persistence failed', { feature });
        }
      });
  }

  limitFor(role: Role, feature: string): number {
    if (feature in DAILY_LIMITS[role]) return DAILY_LIMITS[role][feature];
    if (feature in MONTHLY_LIMITS[role]) return MONTHLY_LIMITS[role][feature];
    return 0;
  }

  isMonthly(feature: string) {
    return feature === 'ai_video';
  }

  /** ISO timestamp of the next quota reset (UTC midnight daily, 1st monthly). */
  resetAt(feature: string): string {
    const now = new Date();
    if (this.isMonthly(feature)) {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    }
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    ).toISOString();
  }

  /**
   * Redis unavailable. Development: degrade to allow (keep local flows
   * working). Production: fail closed with 503 — silently granting unlimited
   * usage during a Redis outage is a revenue/abuse incident.
   */
  private unavailable(feature: string): never {
    throw new HttpException(
      {
        statusCode: 503,
        error: 'Quota service temporarily unavailable — please retry shortly',
        feature,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /** Check without consuming. Returns { allowed, remaining, limit }. */
  async check(
    userId: string,
    role: Role,
    feature: string,
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = this.limitFor(role, feature);
    if (limit === -1) return { allowed: true, remaining: -1, limit };
    if (!this.redis) {
      if (quotaFailOpen()) return { allowed: true, remaining: limit, limit };
      this.unavailable(feature);
    }
    const key = this.keyFor(userId, feature);
    let used: number;
    try {
      used = Number((await this.redis.get(key)) ?? 0);
      if (used === 0) {
        // Redis key missing (fresh period or a flush/failover): re-seed from
        // the durable ledger so paid limits survive a Redis loss.
        used = Math.max(used, await this.rehydrate(userId, feature));
      }
    } catch {
      incCounter('api_redis_failures_total', { component: 'quota' });
      // Redis is configured but unreachable: same policy as "no Redis".
      if (quotaFailOpen()) return { allowed: true, remaining: limit, limit };
      this.unavailable(feature);
    }
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
  }

  /** Best-effort quota refund (e.g. failed render jobs) — never throws. */
  async refund(userId: string, feature: string, amount = 1): Promise<void> {
    try {
      if (!this.redis || amount <= 0) return;
      const ttl = this.ttlFor(feature);
      // Clamped at zero: a refund after an expired/missing counter must not
      // create a negative balance (which would grant extra free usage).
      await evalDecrFloorZero(this.redis, this.keyFor(userId, feature), amount, ttl);
      this.persist(userId, feature, -amount);
    } catch {
      /* best effort */
    }
  }

  /** Atomically consume 1 unit (or `amount`). Returns same shape as check(). */
  async consume(
    userId: string,
    role: Role,
    feature: string,
    amount = 1,
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = this.limitFor(role, feature);
    if (limit === -1) return { allowed: true, remaining: -1, limit };
    if (!this.redis) {
      if (quotaFailOpen()) return { allowed: true, remaining: limit, limit };
      this.unavailable(feature);
    }
    const key = this.keyFor(userId, feature);
    const ttl = this.ttlFor(feature);
    let used: number;
    let allowed: boolean;
    try {
      // Atomic INCR + TTL + limit check + rollback (Lua): a crash can never
      // leave a TTL-less key, and an over-limit increment never sticks (no
      // phantom charges when concurrent requests race past the limit).
      const res = await evalConsumeLimited(this.redis, key, amount, ttl, limit);
      used = res.used;
      allowed = res.allowed;
    } catch {
      incCounter('api_redis_failures_total', { component: 'quota' });
      if (quotaFailOpen()) return { allowed: true, remaining: limit, limit };
      this.unavailable(feature);
    }
    // Write-through to the durable ledger so a Redis flush/failover can be
    // healed by rehydrate() — a paid user never gets their quota reset.
    if (allowed) this.persist(userId, feature, amount);
    return { allowed, remaining: Math.max(0, limit - used), limit };
  }

  /**
   * Atomic gate-and-consume for money paths: consumes the feature or throws
   * the exact 429 contract the QuotaGuard and web paywall expect. Call this
   * immediately BEFORE spending budget (LLM calls, render jobs) and refund on
   * failure paths. Closes the check-then-consume race: the authoritative gate
   * is one atomic Redis operation, not the advisory guard check.
   */
  async consumeOrThrow(userId: string, role: Role, feature: string, amount = 1): Promise<void> {
    const res = await this.consume(userId, role, feature, amount);
    if (!res.allowed) {
      incCounter('api_quota_denied_total', { feature });
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Quota exhausted',
          feature,
          limit: res.limit,
          resetAt: this.resetAt(feature),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Retroactive usage accounting (e.g. call minutes already spent). Unlike
   * consume(), usage that already happened is ALWAYS recorded — even beyond
   * the limit — so billing/analytics stay truthful. Never throws on over-limit.
   */
  async record(userId: string, feature: string, amount = 1): Promise<void> {
    if (amount <= 0) return;
    if (!this.redis) {
      this.persist(userId, feature, amount);
      return;
    }
    try {
      await evalIncrWithTtl(this.redis, this.keyFor(userId, feature), amount, this.ttlFor(feature));
    } catch {
      incCounter('api_redis_failures_total', { component: 'quota' });
    }
    // Record actual usage in the ledger regardless of Redis state.
    this.persist(userId, feature, amount);
  }
}
