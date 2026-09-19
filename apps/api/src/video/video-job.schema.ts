import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { type HydratedDocument } from 'mongoose';

/** Per-request render job (spec §2.6 async video flow). Canonical holds the reusable result. */
export type VideoJobDocument = HydratedDocument<VideoJob>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class VideoJob {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'Canonical', required: true, index: true })
  canonical_id!: mongoose.Types.ObjectId;

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

  /**
   * Local absolute path of the rendered mp4 (dev fallback only).
   * In cloud mode (R2_*) the file is uploaded then deleted — see video_key/url.
   */
  @Prop()
  video_path?: string;

  /** R2 object key, e.g. `videos/<jobId>.mp4` (cloud mode). */
  @Prop()
  video_key?: string;

  /** Public R2 URL when R2_PUBLIC_BASE_URL is set (cloud mode). */
  @Prop()
  video_url?: string;

  /** Where the playable bytes live: `r2` (cloud) or `local` (disk fallback). */
  @Prop({ enum: ['r2', 'local'], default: 'local' })
  video_storage!: 'r2' | 'local';

  /**
   * Learning-path topic this explainer belongs to (Phase 10 playlists).
   * Unset for one-off per-answer videos.
   */
  @Prop({ index: true })
  topic_id?: string;

  /**
   * Position (0..4) inside the topic's 3-5 video playlist. Unset = standalone
   * (one-off or the playlist already has five entries).
   */
  @Prop({ min: 0, max: 4 })
  sequence_index?: number;

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
