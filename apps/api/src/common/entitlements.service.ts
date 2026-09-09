import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module.js';

export type Role = 'free' | 'pro' | 'admin';

/**
 * Central entitlements/quota service (spec §2.7, §5.2, §6.2).
 * Every gated endpoint checks here BEFORE spending budget (LLM, video, SFU).
 *
 * Phase 0: fixed-window Redis counters (INCR + EXPIRE). No Mongo persistence yet —
 * quota_usage collection + billing-cycle resets land in Phase 1 with Stripe.
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
  constructor(@Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null) {}

  private dayKey(userId: string, feature: string) {
    return `quota:${userId}:${new Date().toISOString().slice(0, 10)}:${feature}`;
  }

  private monthKey(userId: string, feature: string) {
    return `quota:${userId}:${new Date().toISOString().slice(0, 7)}:${feature}`;
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

  /** Check without consuming. Returns { allowed, remaining, limit }. */
  async check(
    userId: string,
    role: Role,
    feature: string,
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = this.limitFor(role, feature);
    if (limit === -1) return { allowed: true, remaining: -1, limit };
    if (!this.redis) return { allowed: true, remaining: limit, limit }; // degraded dev mode
    const key = this.isMonthly(feature)
      ? this.monthKey(userId, feature)
      : this.dayKey(userId, feature);
    const used = Number((await this.redis.get(key)) ?? 0);
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
  }

  /** Best-effort quota refund (e.g. failed render jobs) — never throws. */
  async refund(userId: string, feature: string, amount = 1): Promise<void> {
    try {
      if (!this.redis || amount <= 0) return;
      const key = this.isMonthly(feature)
        ? this.monthKey(userId, feature)
        : this.dayKey(userId, feature);
      await this.redis.decrby(key, amount);
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
    if (!this.redis) return { allowed: true, remaining: limit, limit };
    const key = this.isMonthly(feature)
      ? this.monthKey(userId, feature)
      : this.dayKey(userId, feature);
    const ttl = this.isMonthly(feature) ? 31 * 86400 : 86400;
    const used = await this.redis.incrby(key, amount);
    if (used === amount) await this.redis.expire(key, ttl);
    return { allowed: used <= limit, remaining: Math.max(0, limit - used), limit };
  }
}
