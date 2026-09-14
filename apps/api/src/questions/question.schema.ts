import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `questions`. Embedding/dedupe + review queue land in Phase 2. */
export type QuestionDocument = HydratedDocument<Question>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Question {
  @Prop({ required: true, index: true })
  topic!: string;

  @Prop()
  subtopic?: string;

  @Prop({ enum: ['easy', 'medium', 'hard'], required: true, index: true })
  difficulty!: 'easy' | 'medium' | 'hard';

  @Prop({ enum: ['mcq', 'short_answer', 'code'], required: true })
  type!: 'mcq' | 'short_answer' | 'code';

  @Prop({ required: true })
  prompt!: string;

  @Prop({ type: [String], default: undefined })
  options?: string[];

  /** Never sent to the client before answering. */
  @Prop({ required: true, select: false })
  correct_answer!: string;

  @Prop({ required: true })
  explanation!: string;

  @Prop({ enum: ['seed', 'ai_generated'], default: 'seed' })
  source!: string;

  /** Model that generated the question (spec §3); 'seed' rows leave this unset. */
  @Prop()
  generation_model?: string;

  /** Automated quality score 0..1 (spec: confidence for the review queue). */
  @Prop()
  quality_score?: number;

  /** Why the item was routed to human review (null when auto-approved). */
  @Prop()
  flag_reason?: string;

  /** Reserved for Atlas Vector Search dedupe (spec §4); null until an embeddings provider is configured. */
  @Prop({ type: [Number], default: undefined, select: false })
  embedding?: number[];

  @Prop({
    enum: ['approved', 'pending_review', 'flagged'],
    default: 'approved',
    index: true,
  })
  quality_status!: string;

  @Prop({ default: 0 })
  times_served!: number;

  @Prop({ default: 0 })
  times_correct!: number;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ topic: 1, difficulty: 1, quality_status: 1 });
