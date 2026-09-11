import { createHmac } from 'crypto';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { VideoJob, VideoJobDocument } from './video-job.schema.js';
import { Canonical, CanonicalDocument } from '../ai/canonical.schema.js';
import { AiQuery, AiQueryDocument } from '../ai/ai-query.schema.js';
import { LLM_PROVIDER } from '../llm/llm.provider.js';
import type { LlmProvider } from '../llm/llm.provider.js';
import { EntitlementsService, Role } from '../common/entitlements.service.js';
import { FfmpegRenderer } from './renderer.js';
import { NoopTts, TTS_PROVIDER } from './tts.provider.js';
import type { TtsProvider } from './tts.provider.js';
import { ExplainerScript, narrationDuration } from './script.js';

export const VIDEO_QUEUE = 'video-render';
const VIDEO_DIR = join(process.cwd(), 'storage', 'videos');
const TMP_DIR = join(process.cwd(), 'storage', 'tmp');

const envInt = (k: string, fb: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : fb;
};
const videoCost = () => {
  const v = Number(process.env.VIDEO_COST_USD);
  return Number.isFinite(v) && v >= 0 ? v : 0.02;
};
const secret = () =>
  process.env.VIDEO_SECRET ??
  (() => {
    // eslint-disable-next-line no-console
    console.warn('[video] VIDEO_SECRET unset — using insecure dev default. Set it in production.');
    return 'dev-video-secret';
  })();

/** Free tier: cached-ready videos only (spec §6.2 — novel renders are Pro). */
export function mayRenderNew(role: Role): boolean {
  return role !== 'free';
}

/**
 * Explainer video pipeline (spec §2.6 + §5): canonical reuse → tier/quota/
 * budget gates → BullMQ render job (script → narration pacing → ffmpeg mp4).
 * Failures refund quota (fairness) but still count toward the spend budget.
 */
@Injectable()
export class VideoService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private renderer = new FfmpegRenderer();
  private tts: TtsProvider = new NoopTts();

  constructor(
    @InjectModel(VideoJob.name) private readonly jobs: Model<VideoJobDocument>,
    @InjectModel(Canonical.name) private readonly canonicals: Model<CanonicalDocument>,
    @InjectModel(AiQuery.name) private readonly queries: Model<AiQueryDocument>,
    private readonly entitlements: EntitlementsService,
    @Inject(LLM_PROVIDER) @Optional() private readonly llm?: LlmProvider,
    @Inject(TTS_PROVIDER) @Optional() tts?: TtsProvider,
  ) {
    if (tts) this.tts = tts;
  }

  get monthlyBudget() {
    return envInt('VIDEO_MONTHLY_BUDGET', 200);
  }

  private budgetKey(month = new Date().toISOString().slice(0, 7)) {
    return `video:budget:${month}`;
  }

  async onModuleInit() {
    await fs.mkdir(VIDEO_DIR, { recursive: true });
    if (!process.env.REDIS_URL) {
      // eslint-disable-next-line no-console
      console.warn('[video] REDIS_URL unset — video endpoints will 503.');
      return;
    }
    const conn = () => new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    this.queue = new Queue(VIDEO_QUEUE, { connection: conn() });
    if (process.env.VIDEO_WORKER !== 'false') {
      const ok = await this.renderer.available();
      this.worker = new Worker(VIDEO_QUEUE, (job) => this.process(String(job.data.jobId)), {
        connection: conn(),
        concurrency: 1, // renders are CPU-heavy; scale workers, not concurrency
      });
      this.worker.on('failed', (job, err) =>
        // eslint-disable-next-line no-console
        console.warn(`[video] job ${job?.id} failed: ${err.message}`),
      );
      // eslint-disable-next-line no-console
      console.log(`[video] worker live (ffmpeg=${ok}, tts=${this.tts.name})`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      const err = new Error('Video pipeline unavailable (REDIS_URL unset)') as Error & { status: number };
      err.status = 503;
      throw err;
    }
    return this.queue;
  }

  /** Resolve the canonical for a request (by canonical id or owned query id). */
  private async resolveCanonical(userId: string, input: { canonicalId?: string; queryId?: string }) {
    if (input.canonicalId) {
      if (!Types.ObjectId.isValid(input.canonicalId)) {
        throw new HttpException({ statusCode: 400, error: 'Invalid canonicalId' }, HttpStatus.BAD_REQUEST);
      }
      const c = await this.canonicals.findById(input.canonicalId).exec();
      if (!c) throw new HttpException({ statusCode: 404, error: 'Canonical not found' }, HttpStatus.NOT_FOUND);
      return c;
    }
    if (input.queryId) {
      if (!Types.ObjectId.isValid(input.queryId)) {
        throw new HttpException({ statusCode: 400, error: 'Invalid queryId' }, HttpStatus.BAD_REQUEST);
      }
      const q = await this.queries.findOne({ _id: input.queryId, user_id: userId }).exec();
      if (!q?.canonical_id) {
        throw new HttpException({ statusCode: 404, error: 'No reusable answer for this query' }, HttpStatus.NOT_FOUND);
      }
      const c = await this.canonicals.findById(q.canonical_id).exec();
      if (!c) throw new HttpException({ statusCode: 404, error: 'Canonical not found' }, HttpStatus.NOT_FOUND);
      return c;
    }
    throw new HttpException({ statusCode: 400, error: 'canonicalId or queryId required' }, HttpStatus.BAD_REQUEST);
  }

  private async readyJobFor(canonicalId: Types.ObjectId) {
    return this.jobs
      .findOne({ canonical_id: canonicalId, status: 'ready' })
      .sort({ _id: -1 })
      .exec();
  }

  async request(userId: string, role: Role, input: { canonicalId?: string; queryId?: string }) {
    const canon = await this.resolveCanonical(userId, input);

    // Canonical reuse: instant, quota-free (spec §2.6 single most important lever).
    const ready = await this.readyJobFor(canon._id);
    if (ready) {
      canon.times_reused += 1;
      await canon.save();
      return { cached: true, jobId: String(ready._id), status: 'ready' as const, videoUrl: this.fileUrl(ready._id) };
    }

    if (!mayRenderNew(role)) {
      throw new HttpException(
        { statusCode: 429, error: 'New explainer videos are a Pro perk — upgrade to render this one', feature: 'ai_video', proRequired: true },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const quota = await this.entitlements.check(userId, role, 'ai_video');
    if (!quota.allowed) {
      throw new HttpException(
        { statusCode: 429, error: 'Monthly video quota exhausted', feature: 'ai_video', limit: quota.limit, resetAt: this.entitlements.resetAt('ai_video') },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (process.env.REDIS_URL) {
      const c = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      try {
        await c.connect();
        const used = await c.incr(this.budgetKey());
        if (used === 1) await c.expire(this.budgetKey(), 31 * 86400);
        if (used > this.monthlyBudget) {
          await c.decr(this.budgetKey());
          throw new HttpException(
            { statusCode: 503, error: 'Render capacity exhausted for this month — try again later' },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      } finally {
        c.disconnect();
      }
    }

    await this.entitlements.consume(userId, role, 'ai_video');
    const job = await this.jobs.create({
      user_id: userId,
      canonical_id: canon._id,
      status: 'queued',
      stage: 'script',
      progress: 5,
      cost_usd_estimate: videoCost(),
    });
    canon.video_status = 'queued';
    await canon.save();
    await this.requireQueue().add(`render:${job._id}`, { jobId: String(job._id) }, { attempts: 1, removeOnComplete: 50 });
    return { cached: false, jobId: String(job._id), status: 'queued' as const, videoUrl: null };
  }

  async status(userId: string, role: Role, id: string) {
    const job = await this.owned(userId, role, id);
    return this.shape(job);
  }

  async mine(userId: string, limit = 20) {
    const rows = await this.jobs
      .find({ user_id: userId })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    return { items: rows.map((r) => this.shape(r)) };
  }

  /** Signed short-lived playback URL for <video> tags (can't send auth headers). */
  fileToken(id: string): { url: string; expiresAt: string } {
    const exp = Date.now() + 10 * 60000;
    const sig = createHmac('sha256', secret()).update(`${id}.${exp}`).digest('hex');
    return { url: `/ai/videos/file/${id}?t=${exp}.${sig}`, expiresAt: new Date(exp).toISOString() };
  }

  streamFile(id: string, token: string | undefined, res: Response) {
    const [exp, sig] = (token ?? '').split('.');
    const expect = createHmac('sha256', secret()).update(`${id}.${exp}`).digest('hex');
    if (!exp || !sig || sig !== expect || Number(exp) < Date.now()) {
      throw new HttpException({ statusCode: 403, error: 'Invalid or expired file token' }, HttpStatus.FORBIDDEN);
    }
    return this.jobs.findById(id).exec().then((job) => {
      if (!job || job.status !== 'ready' || !job.video_path) {
        throw new HttpException({ statusCode: 404, error: 'Video not ready' }, HttpStatus.NOT_FOUND);
      }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      createReadStream(job.video_path).pipe(res);
    });
  }

  async monthStats() {
    const month = new Date().toISOString().slice(0, 7);
    const start = new Date(`${month}-01T00:00:00Z`);
    const [started, ready, failed] = await Promise.all([
      this.jobs.countDocuments({ created_at: { $gte: start } }).exec(),
      this.jobs.countDocuments({ status: 'ready', created_at: { $gte: start } }).exec(),
      this.jobs.countDocuments({ status: 'failed', created_at: { $gte: start } }).exec(),
    ]);
    return { month, started, ready, failed, budget: this.monthlyBudget, estCostUsd: started * videoCost() };
  }

  /** Job processor: script → narration pacing → ffmpeg render → publish. */
  async process(jobId: string) {
    const job = await this.jobs.findById(jobId).exec();
    if (!job || job.status !== 'queued') return { skipped: true };
    const canon = await this.canonicals.findById(job.canonical_id).exec();
    if (!canon) throw new Error('canonical gone');

    try {
      job.status = 'generating';
      job.stage = 'script';
      job.progress = 20;
      await job.save();

      if (!this.llm) throw new Error('No LLM provider configured');
      const built = await this.llm.buildScript(canon.canonical_text, canon.text_answer);
      const script: ExplainerScript = {
        title: built.title,
        scenes: built.scenes.slice(0, 5).map((s) => ({
          heading: s.heading,
          bullets: s.bullets.slice(0, 3),
          narration: s.narration,
          durationSec: s.durationSec ?? narrationDuration(s.narration),
        })),
      };
      job.script = script as unknown as Record<string, unknown>;
      job.stage = 'audio';
      job.progress = 40;
      await job.save();

      // Narration: real TTS audio when ELEVENLABS_API_KEY is set, else
      // silence pacing. Audio paths ride along to the renderer for muxing.
      const audioPaths: Array<string | null> = [];
      for (const sc of script.scenes) {
        const track = await this.tts.synthesize(sc.narration);
        sc.durationSec = track.durationSec;
        audioPaths.push(track.audioPath);
      }
      job.stage = 'render';
      job.progress = 60;
      await job.save();

      const workdir = join(TMP_DIR, String(job._id));
      const outPath = join(VIDEO_DIR, `${job._id}.mp4`);
      const { durationSec } = await this.renderer.render(script, workdir, outPath, audioPaths);
      await fs.rm(workdir, { recursive: true, force: true });
      const stat = await fs.stat(outPath);

      job.status = 'ready';
      job.stage = 'done';
      job.progress = 100;
      job.video_path = outPath;
      job.video_bytes = stat.size;
      job.duration_sec = durationSec;
      await job.save();

      canon.video_status = 'ready';
      canon.video_url = this.fileUrl(job._id);
      await canon.save();
      return { jobId, status: 'ready', durationSec };
    } catch (err) {
      job.status = 'failed';
      job.error = (err as Error).message.slice(0, 500);
      await job.save();
      const canon2 = await this.canonicals.findById(job.canonical_id).exec();
      if (canon2 && canon2.video_status !== 'ready') {
        canon2.video_status = 'failed';
        await canon2.save();
      }
      // Refund quota (fairness) — spend budget still counts (spec §5.4).
      await this.entitlements.refund(job.user_id, 'ai_video', 1);
      throw err;
    }
  }

  private async owned(userId: string, role: Role, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const job = await this.jobs.findById(id).exec();
    if (!job) throw new HttpException({ statusCode: 404, error: 'Not found' }, HttpStatus.NOT_FOUND);
    if (job.user_id !== userId && role !== 'admin') {
      throw new HttpException({ statusCode: 403, error: 'Not your video' }, HttpStatus.FORBIDDEN);
    }
    return job;
  }

  private fileUrl(jobId: Types.ObjectId | string) {
    return `/ai/videos/file/${String(jobId)}`;
  }

  private shape(j: VideoJobDocument | Record<string, unknown>) {
    const o = (j as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (j as Record<string, unknown>);
    const id = String(o._id);
    return {
      id,
      status: o.status,
      stage: o.stage,
      progress: o.progress,
      videoUrl: o.status === 'ready' ? this.fileUrl(id) : null,
      fileToken: o.status === 'ready' ? this.fileToken(id) : null,
      script: o.script,
      durationSec: o.duration_sec,
      error: o.error,
      createdAt: o.created_at,
    };
  }
}
