import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Question, QuestionDocument } from '../questions/question.schema.js';
import { LLM_PROVIDER } from '../llm/llm.provider.js';
import type { LlmProvider } from '../llm/llm.provider.js';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { isDuplicate, qualityCheck } from './quality.js';

export const GEN_QUEUE = 'question-gen';
const TOPICS = ['ml-basics', 'statistics', 'neural-networks', 'deep-learning', 'llms', 'evaluation'];
const DIFFS = ['easy', 'medium', 'hard'] as const;

const envInt = (k: string, fb: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : fb;
};
const envFloat = (k: string, fb: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : fb;
};

export interface GenJob {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

/**
 * AI backfill pipeline (spec §7 Phase 2): keeps ≥ target approved questions
 * per (topic × difficulty). Jobs run on BullMQ (Redis); concurrency + daily
 * budget caps bound cost (spec §5.4). Without REDIS_URL the service degrades
 * to explicit 503s instead of silent no-ops.
 */
@Injectable()
export class GenerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Generation');
  private queue: Queue<GenJob> | null = null;
  private worker: Worker<GenJob> | null = null;
  private redisUrl = process.env.REDIS_URL;

  constructor(
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
    @Inject(LLM_PROVIDER) @Optional() private readonly llm?: LlmProvider,
  ) {}

  get target() { return envInt('GENERATION_BUFFER_TARGET', 500); }
  get batchSize() { return envInt('GENERATION_BATCH_SIZE', 10); }
  get concurrency() { return envInt('GENERATION_CONCURRENCY', 2); }
  get dailyBudget() { return envInt('GENERATION_DAILY_BUDGET', 500); }
  get threshold() { return envFloat('GENERATION_SIMILARITY_THRESHOLD', 0.85); }
  get providerName() { return this.llm?.name ?? 'none'; }

  private newConnection() {
    // BullMQ needs maxRetriesPerRequest:null — never share the app's Redis client.
    // enableReadyCheck:false is required for Upstash serverless redis.
    return new Redis(this.redisUrl!, { maxRetriesPerRequest: null, enableReadyCheck: false });
  }

  async onModuleInit() {
    if (!this.redisUrl) {
      this.logger.warn('REDIS_URL unset — generation endpoints will 503.');
      return;
    }
    this.queue = new Queue<GenJob>(GEN_QUEUE, { connection: this.newConnection() });
    if (process.env.GENERATION_WORKER !== 'false') {
      this.worker = new Worker<GenJob>(GEN_QUEUE, (job) => this.process(job.data), {
        connection: this.newConnection(),
        concurrency: this.concurrency,
        // Stay under Groq free 30 RPM: max 20 gen-calls/min across the worker.
        limiter: { max: 20, duration: 60000 },
      });
      this.worker.on('failed', (job, err) =>
        this.logger.warn(`job ${job?.id} failed: ${err.message}`),
      );
      this.logger.log(`worker live (provider=${this.providerName}, concurrency=${this.concurrency})`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private requireQueue(): Queue<GenJob> {
    if (!this.queue) {
      throw new HttpException(
        { statusCode: 503, error: 'Generation queue unavailable (REDIS_URL unset — start redis or set REDIS_URL)' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.queue;
  }

  private budgetKey(day = new Date().toISOString().slice(0, 10)) {
    return `gen:budget:${day}`;
  }

  async budgetUsed(): Promise<number> {
    if (!this.redisUrl) return 0;
    if (this.redis) {
      try {
        return Number((await this.redis.get(this.budgetKey())) ?? 0);
      } catch {
        return 0;
      }
    }
    const c = new Redis(this.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await c.connect();
      return Number((await c.get(this.budgetKey())) ?? 0);
    } catch {
      return 0;
    } finally {
      c.disconnect();
    }
  }

  /** Per-(topic × difficulty) approved/pending counts + queue depth + budget. */
  async status() {
    const rows = await this.questions
      .aggregate([
        { $group: { _id: { topic: '$topic', difficulty: '$difficulty', qs: '$quality_status' }, count: { $sum: 1 } } },
      ])
      .exec();
    const bank: Record<string, Record<string, { approved: number; pending: number }>> = {};
    for (const r of rows as Array<{ _id: { topic: string; difficulty: string; qs: string }; count: number }>) {
      bank[r._id.topic] ??= {};
      bank[r._id.topic][r._id.difficulty] ??= { approved: 0, pending: 0 };
      if (r._id.qs === 'approved') bank[r._id.topic][r._id.difficulty].approved += r.count;
      else bank[r._id.topic][r._id.difficulty].pending += r.count;
    }
    let jobs = null;
    try {
      if (this.queue) jobs = await this.queue.getJobCounts('waiting', 'active', 'failed');
    } catch { jobs = null; }
    return {
      provider: this.providerName,
      target: this.target,
      budget: { used: await this.budgetUsed(), daily: this.dailyBudget },
      jobs,
      bank,
    };
  }

  /** Enqueue top-up jobs wherever the approved buffer is below target. */
  async ensureBuffer(topic?: string, difficulty?: 'easy' | 'medium' | 'hard') {
    const queue = this.requireQueue();
    // Stop early when the daily budget is already spent (yours showed 288/150).
    const used = await this.budgetUsed();
    if (used >= this.dailyBudget) {
      throw new HttpException(
        { statusCode: 429, error: `Daily generation budget spent (${used}/${this.dailyBudget}) — resets 00:00 UTC` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const combos: Array<{ topic: string; difficulty: 'easy' | 'medium' | 'hard' }> = [];
    for (const t of topic ? [topic] : TOPICS)
      for (const d of difficulty ? [difficulty] : DIFFS) combos.push({ topic: t, difficulty: d });

    const enqueued: GenJob[] = [];
    // One press = full deficit: every combo enqueued to 500 in a single call.
    // ~900 jobs for an empty bank; the worker grinds through at ~20 calls/min
    // with retries, so wall-clock is hours (Groq free quotas pace it). No cap.
    for (const c of combos) {
      const approved = await this.questions
        .countDocuments({ topic: c.topic, difficulty: c.difficulty, quality_status: 'approved' })
        .exec();
      let deficit = this.target - approved;
      while (deficit > 0) {
        const count = Math.min(deficit, this.batchSize);
        // Stable jobId = one job per (combo, deficit position). Pressing
        // "top up" twice no longer duplicates the same ~900 jobs; once a batch
        // completes, the deficit shrinks and the next id is free again.
        const jobId = `topup:${c.topic}:${c.difficulty}:${deficit}`;
        await queue.add(
          `topup:${c.topic}:${c.difficulty}`,
          { ...c, count },
          {
            jobId,
            attempts: 8,
            backoff: { type: 'exponential', delay: 30000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
        enqueued.push({ ...c, count });
        deficit -= count;
      }
    }
    return { enqueued, target: this.target };
  }

  /** Clear the failed pile (yours showed 67) after a fix — keeps waiting/active. */
  async cleanFailed() {
    const queue = this.requireQueue();
    await queue.clean(0, 1000, 'failed');
    return this.status();
  }

  /** Drain not-yet-started jobs (waiting + delayed) so a retarget (500→400)
   * doesn't overshoot: active job finishes, then re-press Top-up for the new target. */
  async drainWaiting() {
    const queue = this.requireQueue();
    await queue.drain();
    await queue.clean(0, 0, 'wait');
    await queue.clean(0, 0, 'delayed');
    return this.status();
  }

  /** Hard-cap the bank at target approved per (topic × difficulty).
   * Keeps the oldest (seeds + earliest generations), deletes surplus approved
   * plus pending_review in combos already at target. Returns per-combo counts. */
  async trimToTarget() {
    const target = this.target;
    const combos = await this.questions
      .aggregate([
        { $group: { _id: { topic: '$topic', difficulty: '$difficulty' } } },
      ])
      .exec() as Array<{ _id: { topic: string; difficulty: string } }>;
    const trimmed: Array<{ topic: string; difficulty: string; deletedApproved: number; deletedPending: number }> = [];
    for (const c of combos) {
      const topic: string = c._id.topic;
      const difficulty = c._id.difficulty as 'easy' | 'medium' | 'hard';
      const keep = await this.questions
        .find({ topic, difficulty, quality_status: 'approved' })
        .sort({ _id: 1 })
        .select('_id')
        .lean()
        .exec();
      let deletedApproved = 0;
      if (keep.length > target) {
        const surplusIds = keep.slice(target).map((q) => q._id);
        const r = await this.questions.deleteMany({ _id: { $in: surplusIds } }).exec();
        deletedApproved = r.deletedCount ?? 0;
      }
      let deletedPending = 0;
      const approvedNow = Math.min(keep.length, target);
      if (approvedNow >= target) {
        const r = await this.questions
          .deleteMany({ topic, difficulty, quality_status: 'pending_review' })
          .exec();
        deletedPending = r.deletedCount ?? 0;
      }
      if (deletedApproved > 0 || deletedPending > 0) {
        trimmed.push({ topic, difficulty, deletedApproved, deletedPending });
      }
    }
    return { target, trimmed, status: await this.status() };
  }

  /**
   * Atomically reserve `count` units of the daily generation budget.
   * Returns true when reserved (caller must refund on failure).
   */
  private async reserveBudget(client: Redis, count: number): Promise<boolean> {
    const used = await client.incrby(this.budgetKey(), count);
    if (used === count) await client.expire(this.budgetKey(), 86400);
    if (used > this.dailyBudget) {
      await client.decrby(this.budgetKey(), count);
      throw new Error(`daily generation budget exceeded (${this.dailyBudget})`);
    }
    return true;
  }

  /** Best-effort budget refund when a job fails before producing output. */
  private async refundBudget(count: number): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.decrby(this.budgetKey(), count);
        return;
      }
      if (!this.redisUrl) return;
      const c = new Redis(this.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
      try {
        await c.connect();
        await c.decrby(this.budgetKey(), count);
      } finally {
        c.disconnect();
      }
    } catch {
      /* refund is best-effort */
    }
  }

  /** Job processor: generate → quality gate → dedupe → insert. */
  async process(data: GenJob) {
    if (!this.llm) throw new Error('No LLM provider configured');

    // Daily cost circuit-breaker (spec §5.4) — counted in generated units.
    // Reserve budget first; refund on failure so dead jobs don't eat the day (yours hit 288/150).
    let reserved = false;
    if (this.redisUrl && !this.redis) {
      const c = new Redis(this.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
      try {
        await c.connect();
        reserved = await this.reserveBudget(c, data.count);
      } finally {
        c.disconnect();
      }
    } else if (this.redis) {
      reserved = await this.reserveBudget(this.redis, data.count);
    }

    try {
      const avoid = (
        await this.questions.find({ topic: data.topic }).select('prompt').sort({ _id: -1 }).limit(20).lean().exec()
      ).map((q) => q.prompt);

      const generated = await this.llm.generateQuestions({ ...data, avoidPrompts: avoid });
    const existing = (
      await this.questions.find({ topic: data.topic }).select('prompt').lean().exec()
    ).map((q) => q.prompt);

    let inserted = 0, flagged = 0, skippedDup = 0, skippedBad = 0;
    for (const g of generated) {
      try {
        // Drop structurally-invalid items (missing DB-required paths) instead of
        // letting one bad item fail the whole batch of 10.
        if (
          !g || typeof g !== 'object' ||
          typeof g.prompt !== 'string' || !g.prompt.trim() ||
          typeof g.correct_answer !== 'string' || !g.correct_answer.trim() ||
          typeof g.explanation !== 'string' || !g.explanation.trim()
        ) {
          skippedBad++;
          continue;
        }
        const verdict = qualityCheck(g);
      if (!verdict.ok) {
        await this.questions.create({
          ...g, source: 'ai_generated', generation_model: this.llm.name,
          quality_status: 'pending_review', quality_score: verdict.score,
          flag_reason: verdict.reasons.join('; '),
        });
        flagged++;
        continue;
      }
      if (isDuplicate(g.prompt, existing, this.threshold)) {
        skippedDup++;
        continue;
      }
      await this.questions.create({
        ...g, source: 'ai_generated', generation_model: this.llm.name,
        quality_status: 'approved', quality_score: verdict.score,
      });
      existing.push(g.prompt);
      inserted++;
      } catch (itemErr) {
        // One bad item (validation, dup index race) must not kill the other 9.
        this.logger.warn(
          `skipping bad item (${data.topic}/${data.difficulty}): ${(itemErr as Error).message.slice(0, 160)}`,
        );
        skippedBad++;
        continue;
      }
      }
      return { topic: data.topic, difficulty: data.difficulty, inserted, flagged, skippedDup, skippedBad };
    } catch (err) {
      if (reserved) await this.refundBudget(data.count);
      throw err;
    }
  }
}
