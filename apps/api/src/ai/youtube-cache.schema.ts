import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Aggressively cached YouTube search results (spec §2.6: 10k units/day quota).
 * Keyed by normalized query; refreshed after YOUTUBE_CACHE_DAYS (default 7).
 */
export type YoutubeCacheDocument = HydratedDocument<YoutubeCache>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class YoutubeCache {
  @Prop({ required: true, unique: true, index: true })
  normalized_query!: string;

  @Prop({
    type: [{ video_id: String, title: String, thumbnail_url: String, channel: String }],
    default: [],
  })
  results!: Array<{ video_id: string; title: string; thumbnail_url: string; channel: string }>;

  @Prop({ required: true })
  fetched_at!: Date;
}

export const YoutubeCacheSchema = SchemaFactory.createForClass(YoutubeCache);
