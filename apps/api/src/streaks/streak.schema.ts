import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `streaks` — audit log; current/longest also cached on users. */
export type StreakDocument = HydratedDocument<Streak>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Streak {
  @Prop({ required: true, index: true })
  user_id!: string;

  /** User-local YYYY-MM-DD date (spec §2.3: timezone-aware, not server time). */
  @Prop({ required: true })
  date!: string;

  @Prop({ default: 0 })
  activity_count!: number;

  @Prop({ default: 0 })
  streak_day_number!: number;

  @Prop({ default: false })
  freeze_applied!: boolean;
}

export const StreakSchema = SchemaFactory.createForClass(Streak);
StreakSchema.index({ user_id: 1, date: 1 }, { unique: true });
