import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { type HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `attempts`. */
export type AttemptDocument = HydratedDocument<Attempt>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Attempt {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'Question', required: true, index: true })
  question_id!: mongoose.Types.ObjectId;

  @Prop({ enum: ['easy', 'medium', 'hard'], required: true })
  difficulty!: 'easy' | 'medium' | 'hard';

  @Prop({ required: true })
  topic!: string;

  @Prop({ required: true })
  submitted_answer!: string;

  @Prop({ required: true })
  is_correct!: boolean;

  @Prop({ required: true })
  time_taken_ms!: number;

  @Prop({ required: true })
  points_awarded!: number;

  /** UTC YYYY-MM-DD bucket for daily aggregation/indexing. */
  @Prop({ required: true, index: true })
  day_bucket!: string;

  /**
   * True when this is a same-day re-attempt after the answer was revealed.
   * Retries are scoreless and never count toward topic mastery.
   */
  @Prop({ default: false })
  is_retry!: boolean;

  /**
   * Set when an attempt used a hint. Hint-assisted attempts break mastery
   * streaks (no hint system currently sets this; the field future-proofs the
   * gate query and defaults false for legacy rows).
   */
  @Prop({ default: false })
  hint_used!: boolean;

  /** Set automatically by timestamps option. */
  created_at?: Date;
}

export const AttemptSchema = SchemaFactory.createForClass(Attempt);
AttemptSchema.index({ user_id: 1, day_bucket: 1 });
AttemptSchema.index({ user_id: 1, question_id: 1 });
AttemptSchema.index({ user_id: 1, topic: 1 });
