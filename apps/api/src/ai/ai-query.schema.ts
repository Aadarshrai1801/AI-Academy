import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { type HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `ai_queries`. */
export type AiQueryDocument = HydratedDocument<AiQuery>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class AiQuery {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ required: true, maxlength: 2000 })
  question_text!: string;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'Canonical', default: undefined, index: true })
  canonical_id?: mongoose.Types.ObjectId;

  /** Empty for off-topic queries (which are logged but never answered). */
  @Prop({ default: '' })
  text_answer!: string;

  @Prop({ default: true })
  on_topic!: boolean;

  /** Served from cache at zero marginal cost (no quota consumed). */
  @Prop({ default: false })
  cached!: boolean;

  /** 'ask' = free-form Q&A; 'explain' = mistake diagnosis for a practice question. */
  @Prop({ enum: ['ask', 'explain'], default: 'ask', index: true })
  kind!: 'ask' | 'explain';

  /** Source practice question for 'explain' rows (null for free-form asks). */
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Question', default: undefined })
  question_id?: mongoose.Types.ObjectId;

  @Prop({
    type: [{ video_id: String, title: String, thumbnail_url: String, channel: String }],
    default: [],
  })
  youtube!: Array<{ video_id: string; title: string; thumbnail_url: string; channel: string }>;

  created_at?: Date;
}

export const AiQuerySchema = SchemaFactory.createForClass(AiQuery);
AiQuerySchema.index({ user_id: 1, created_at: -1 });
