import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type MistakeExplanationDocument = HydratedDocument<MistakeExplanation>;

/**
 * Canonical "explain my mistake" cache — deliberately separate from the
 * pure-Q&A `canonical` collection so hit-rate metrics for each stay
 * meaningful (a mistake hit is not a generic answer hit).
 *
 * Key: (normalized question, normalized wrong answer). Exact-match only:
 * a different wrong answer is a different misconception worth generating.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class MistakeExplanation {
  @Prop({ required: true, maxlength: 2000 })
  question_text!: string;

  @Prop({ required: true })
  normalized_question!: string;

  @Prop({ required: true, maxlength: 2000 })
  wrong_answer!: string;

  @Prop({ required: true })
  normalized_wrong_answer!: string;

  @Prop({ required: true })
  text_answer!: string;

  @Prop({ required: true })
  provider_model!: string;

  @Prop({ default: 0 })
  times_reused!: number;
}

export const MistakeExplanationSchema = SchemaFactory.createForClass(MistakeExplanation);
MistakeExplanationSchema.index(
  { normalized_question: 1, normalized_wrong_answer: 1 },
  { unique: true },
);
