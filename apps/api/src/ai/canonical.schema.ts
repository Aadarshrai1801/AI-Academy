import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Canonical reusable Q&A (spec §2.6 cost control + §3 video_cache, video fields land in Phase 5). */
export type CanonicalDocument = HydratedDocument<Canonical>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Canonical {
  @Prop({ required: true })
  canonical_text!: string;

  @Prop({ required: true, unique: true, index: true })
  normalized!: string;

  @Prop({ required: true })
  text_answer!: string;

  @Prop({ required: true })
  provider_model!: string;

  @Prop({ default: 0 })
  times_reused!: number;

  @Prop({ enum: ['none', 'queued', 'generating', 'ready', 'failed'], default: 'none' })
  video_status!: string;

  @Prop()
  video_url?: string;

  /** Reserved for Atlas Vector Search dedupe (spec §4). */
  @Prop({ type: [Number], default: undefined, select: false })
  embedding?: number[];
}

export const CanonicalSchema = SchemaFactory.createForClass(Canonical);
