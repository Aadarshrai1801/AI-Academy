import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Per-request render job (spec §2.6 async video flow). Canonical holds the reusable result. */
export type VideoJobDocument = HydratedDocument<VideoJob>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class VideoJob {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Canonical', required: true, index: true })
  canonical_id!: Types.ObjectId;

  @Prop({
    enum: ['queued', 'generating', 'ready', 'failed'],
    default: 'queued',
    index: true,
  })
  status!: 'queued' | 'generating' | 'ready' | 'failed';

  /** Pipeline stage for progress UI: script → audio → render → done. */
  @Prop({ default: 'script' })
  stage!: string;

  @Prop({ default: 0 })
  progress!: number;

  @Prop({ type: Object, default: undefined })
  script?: Record<string, unknown>;

  /** Absolute path of the rendered mp4 (served via signed file URLs). */
  @Prop()
  video_path?: string;

  @Prop()
  video_bytes?: number;

  @Prop()
  duration_sec?: number;

  @Prop()
  error?: string;

  /** Flat per-render estimate (see VIDEO_COST_USD) for spend tracking. */
  @Prop({ default: 0 })
  cost_usd_estimate!: number;

  created_at?: Date;
}

export const VideoJobSchema = SchemaFactory.createForClass(VideoJob);
VideoJobSchema.index({ user_id: 1, created_at: -1 });
