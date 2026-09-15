import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

/**
 * Durable quota usage ledger (one row per user × feature × period).
 *
 * Redis counters are fast but volatile: a flush, failover, or eviction resets
 * every Pro user's quota mid-period. This collection is the write-through
 * source of truth — after a Redis loss, `EntitlementsService.check()` re-seeds
 * the Redis counter from this ledger (rehydration), so paid limits survive.
 */
@Schema({ collection: 'quota_usage' })
export class QuotaUsage {
  @Prop({ required: true })
  user_id!: string;

  @Prop({ required: true })
  feature!: string;

  /** 'YYYY-MM-DD' for daily features, 'YYYY-MM' for monthly (e.g. ai_video). */
  @Prop({ required: true })
  period!: string;

  @Prop({ default: 0 })
  used!: number;

  @Prop({ default: Date.now })
  updated_at!: Date;
}

export type QuotaUsageDocument = QuotaUsage & Document;
export const QuotaUsageSchema = SchemaFactory.createForClass(QuotaUsage);
QuotaUsageSchema.index({ user_id: 1, feature: 1, period: 1 }, { unique: true });