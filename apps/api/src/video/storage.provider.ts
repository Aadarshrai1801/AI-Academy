import { createReadStream, promises as fs } from 'fs';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloud object storage for explainer mp4s (Cloudflare R2, S3-compatible).
 * When R2 env is missing the pipeline falls back to local disk
 * (dev mode) — see VideoService.
 *
 * Required env for cloud:
 *   R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (R2 API token)
 *   R2_BUCKET=hoopr-videos
 *   R2_REGION=auto (optional, defaults to auto)
 *   R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev  OR  https://videos.yourdomain.com
 *     (optional — when set, playback is a direct public URL; otherwise the
 *      API mints a short-lived presigned URL after checking the file token)
 */

export interface UploadResult {
  key: string;
  url: string | null; // public URL when R2_PUBLIC_BASE_URL is set
}

export interface VideoStorage {
  readonly name: 'r2' | 'local';
  readonly enabled: boolean;
  upload(localPath: string, key: string): Promise<UploadResult>;
  /** Short-lived playable URL (presigned for private buckets, public otherwise). */
  playableUrl(key: string): Promise<string>;
}

const bucket = () => process.env.R2_BUCKET ?? 'hoopr-videos';

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export class R2VideoStorage implements VideoStorage {
  readonly name = 'r2' as const;
  readonly enabled = true;
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.R2_REGION ?? 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
    });
  }

  async upload(localPath: string, key: string): Promise<UploadResult> {
    const stat = await fs.stat(localPath);
    const stream = createReadStream(localPath);
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key,
          Body: stream,
          ContentType: 'video/mp4',
          ContentLength: stat.size,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      stream.destroy();
      throw err;
    }
    const base = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
    return { key, url: base ? `${base}/${key}` : null };
  }

  async playableUrl(key: string): Promise<string> {
    const base = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
    if (base) return `${base}/${key}`;
    // Private bucket — mint a 10-min presigned GET (matches file-token TTL).
    const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 600 });
  }
}

export class LocalVideoStorage implements VideoStorage {
  readonly name = 'local' as const;
  readonly enabled = false;
  async upload(): Promise<UploadResult> {
    throw new Error('Local storage: no upload (served from disk)');
  }
  async playableUrl(): Promise<string> {
    throw new Error('Local storage: served via API stream, not a remote URL');
  }
}

export function selectStorage(): VideoStorage {
  if (r2Configured()) return new R2VideoStorage();
  return new LocalVideoStorage();
}
