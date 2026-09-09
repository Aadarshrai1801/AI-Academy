import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { YoutubeCache, YoutubeCacheDocument } from './youtube-cache.schema.js';
import { normalizeCanonical } from './canonical.js';

export interface YoutubeRec {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel: string;
}

const cacheDays = () => {
  const v = Number(process.env.AI_YOUTUBE_CACHE_DAYS);
  return Number.isFinite(v) && v > 0 ? v : 7;
};

/**
 * YouTube Data API v3 with aggressive caching (spec §2.6).
 * Without YOUTUBE_API_KEY → empty list + disabled flag (text-only answers).
 * Failures (quota exhaustion etc.) degrade to cache-or-empty, never 500.
 */
@Injectable()
export class YoutubeService {
  constructor(
    @InjectModel(YoutubeCache.name) private readonly cache: Model<YoutubeCacheDocument>,
  ) {}

  get configured() {
    return Boolean(process.env.YOUTUBE_API_KEY);
  }

  async recommendations(query: string, maxResults: number): Promise<{ items: YoutubeRec[]; fromCache: boolean }> {
    const norm = normalizeCanonical(query);
    const fresh = await this.cache.findOne({ normalized_query: norm }).lean().exec();
    const ttlMs = cacheDays() * 86400000;
    if (fresh && Date.now() - new Date(fresh.fetched_at).getTime() < ttlMs) {
      return { items: fresh.results.slice(0, maxResults), fromCache: true };
    }

    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return { items: fresh?.results.slice(0, maxResults) ?? [], fromCache: true };

    try {
      const url =
        'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&safeSearch=moderate' +
        `&maxResults=${Math.min(Math.max(maxResults, 1), 10)}&q=${encodeURIComponent(query)}&key=${key}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`YouTube API ${res.status}`);
      const data = (await res.json()) as {
        items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }>;
      };
      const items: YoutubeRec[] = (data.items ?? [])
        .filter((it) => it.id?.videoId)
        .map((it) => ({
          video_id: it.id!.videoId!,
          title: it.snippet?.title ?? 'Untitled',
          thumbnail_url: it.snippet?.thumbnails?.medium?.url ?? '',
          channel: it.snippet?.channelTitle ?? 'Unknown',
        }));
      await this.cache
        .findOneAndUpdate(
          { normalized_query: norm },
          { normalized_query: norm, results: items, fetched_at: new Date() },
          { upsert: true },
        )
        .exec();
      return { items, fromCache: false };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[youtube] fetch failed, serving stale/empty:', (err as Error).message);
      return { items: fresh?.results.slice(0, maxResults) ?? [], fromCache: true };
    }
  }
}
