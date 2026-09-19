import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type TopicMasteryDocument = HydratedDocument<TopicMastery>;

/**
 * Per-user, per-topic mastery score (0–100), separate from points/streaks.
 *
 * - Updated by a per-attempt EMA in `MasteryService.recordAttempt()` (retries
 *   are ignored; hints reduce gains / deepen losses).
 * - Seeded once by the onboarding diagnostic (`source: 'diagnostic'`).
 * - Read with light time decay (`MASTERY_DECAY_HALF_LIFE_DAYS`) so stale
 *   mastery fades and invites review.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class TopicMastery {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ required: true })
  topic!: string;

  /** Stored (undecayed) score 0–100. */
  @Prop({ required: true, min: 0, max: 100 })
  score!: number;

  /** Provenance of the first score for this topic; never rewritten. */
  @Prop({ enum: ['diagnostic', 'attempts'], default: 'attempts' })
  source!: 'diagnostic' | 'attempts';

  /** Non-retry attempts that fed the score. */
  @Prop({ default: 0 })
  attempts_counted!: number;

  @Prop({ default: 0 })
  correct_counted!: number;

  /**
   * Last 14 daily scores (newest last) — the trajectory the /progress path
   * renders. Replaced in place per day so the array never grows unbounded.
   */
  @Prop({ type: [{ day: String, score: Number }], default: [] })
  history!: Array<{ day: string; score: number }>;

  created_at?: Date;
  updated_at?: Date;
}

export const TopicMasterySchema = SchemaFactory.createForClass(TopicMastery);
TopicMasterySchema.index({ user_id: 1, topic: 1 }, { unique: true });
