import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { newBullConnection, workerTuning } from '../common/bull-connection.js';
import { incCounter } from '../common/metrics.js';
import {
  LeaderboardSnapshot,
  SnapshotDocument,
} from './leaderboard-snapshot.schema.js';
import { Attempt, AttemptDocument } from '../attempts/attempt.schema.js';
import { User, UserDocument } from '../users/user.schema.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';
import { rankHardQuestions } from './hardest-questions.js';

export interface BoardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

export interface HistoryPoint {
  day: string;
  rank: number | null;
  score: number;
  accuracy: number | null;
  of: number;
}

/** One entry in the daily hardest-questions board (spec: daily challenge feed). */
export interface HardQuestionEntry {
  rank: number;
  /** Smallest day bucket the question appeared in (YYYY-MM-DD). */
  day: string;
  questionId: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** Prompt text, truncated for display; undefined if the question was purged. */
  prompt?: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number | null;
}

/** Percentile from rank (1 = best) over field size N. */
export function percentile(rank: number | null, of: number): number | null {
  if (rank === null || of <= 0) return null;
  if (of === 1) return 100;
  return Math.round(((of - rank) / (of - 1)) * 100);
}

const boardKey = (day: string) => `lb:daily:${day}`;
const nameKey = (day: string) => `lb:names:${day}`;
const today = () => new Date().toISOString().slice(0, 10);

/** BullMQ queue + cron for the nightly snapshot (00:05 UTC). */
export const SNAPSHOT_QUEUE = 'leaderboard-snapshot';
export const SNAPSHOT_CRON = '5 0 * * *';

/**
 * ms until the next 00:05 UTC run — used only by the in-process fallback
 * scheduler (dev without Redis). Exported for tests.
 */
export function msUntilNextUtcRun(nowMs = Date.now()): number {
  const next = new Date(nowMs);
  next.setUTCHours(0, 5, 0, 0);
  if (next.getTime() <= nowMs) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - nowMs;
}

/**
 * Live daily ranking in Redis sorted sets (spec §2.2): O(log N) ZADD/ZRANK,
 * tie-breaks by member-score ordering (score desc, member asc for determinism).
 * Without Redis, degrades to an in-memory board (single-instance dev only).
 * Daily snapshots persist to Mongo for Pro history (cron calls snapshot()).
 */
@Injectable()
export class LeaderboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Leaderboard');
  private readonly mem = new Map<string, Map<string, number>>();
  private readonly memNames = new Map<string, Map<string, string>>();
  private snapshotQueue: Queue | null = null;
  private snapshotWorker: Worker | null = null;

  constructor(
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
    @InjectModel(LeaderboardSnapshot.name) private readonly snapshots: Model<SnapshotDocument>,
    @InjectModel(Attempt.name) private readonly attempts: Model<AttemptDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
  ) {}

  /**
   * Redis outage policy: the live board is derived state (attempts are the
   * source of truth), so reads degrade to the in-memory board and writes to
   * Redis are skipped instead of failing the user's practice submission.
   */
  private async safe<T>(
    fn: (redis: Redis) => Promise<T>,
    fallback: () => T | Promise<T>,
  ): Promise<T> {
    if (!this.redis) return fallback();
    try {
      return await fn(this.redis);
    } catch (err) {
      this.logger.warn(`redis unavailable — using in-memory board (${(err as Error).message})`);
      return fallback();
    }
  }

  /** Nightly snapshot shortly after the UTC reset (spec §2.2 historical trends). */
  onModuleInit() {
    if (process.env.LEADERBOARD_SNAPSHOT === 'false') return;
    // Catch-up: if the process was down or redeployed across the 00:05 UTC
    // snapshot time, the previous day's snapshot was silently lost. Rebuild it
    // from attempts (the source of truth) whenever it is missing.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    this.snapshots
      .findOne({ period_type: 'daily', period_key: yesterday })
      .lean()
      .exec()
      .then((existing) => (existing ? undefined : this.snapshot(yesterday)))
      .then((result) => {
        if (result) this.logger.log(`catch-up snapshot written for ${yesterday} (${result.entries} entries)`);
      })
      .catch((e: Error) => this.logger.warn(`catch-up snapshot failed for ${yesterday}: ${e.message}`));

    // Prefer a BullMQ repeatable job: it runs once per schedule no matter how
    // many replicas are up (in-process timers would fire on every replica), it
    // survives deploys, and it retries on failure. Without Redis (dev) fall
    // back to an in-process timer.
    if (process.env.REDIS_URL && process.env.LEADERBOARD_WORKER !== 'false') {
      try {
        this.snapshotQueue = new Queue(SNAPSHOT_QUEUE, {
          connection: newBullConnection('leaderboard:queue'),
        });
        this.snapshotWorker = new Worker(
          SNAPSHOT_QUEUE,
          async () => {
            const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            await this.snapshot(day);
          },
          { connection: newBullConnection('leaderboard:worker'), concurrency: 1, ...workerTuning() },
        );
        this.snapshotWorker.on('failed', (job, err) => {
          incCounter('api_jobs_failed_total', { queue: SNAPSHOT_QUEUE });
          this.logger.warn(`snapshot job ${job?.id} failed: ${err.message}`);
        });
        // BullMQ v6: a job scheduler owns the cron (deduped by scheduler id, so
        // every replica converges on exactly one schedule).
        void this.snapshotQueue
          .upsertJobScheduler(
            'leaderboard-daily',
            { pattern: SNAPSHOT_CRON, tz: 'UTC' },
            { name: 'daily', opts: { removeOnComplete: 20, removeOnFail: 50 } },
          )
          .then(() => this.logger.log(`snapshot scheduled (${SNAPSHOT_CRON} UTC, BullMQ job scheduler)`))
          .catch((e: Error) => this.logger.warn(`snapshot scheduling failed: ${e.message}`));
        return;
      } catch (e) {
        this.logger.warn(
          `BullMQ snapshot scheduler unavailable (${(e as Error).message}) — using in-process timer`,
        );
      }
    }

    const schedule = () => {
      setTimeout(() => {
        const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        this.snapshot(day)
          .catch((e: Error) => this.logger.warn(`nightly snapshot failed: ${e.message}`))
          .finally(schedule);
      }, msUntilNextUtcRun()).unref?.();
    };
    schedule();
  }

  async onModuleDestroy() {
    await this.snapshotWorker?.close().catch(() => undefined);
    await this.snapshotQueue?.close().catch(() => undefined);
  }

  private memAdd(userId: string, username: string, points: number, day: string) {
    const board = this.mem.get(day) ?? new Map<string, number>();
    board.set(userId, (board.get(userId) ?? 0) + points);
    this.mem.set(day, board);
    const names = this.memNames.get(day) ?? new Map<string, string>();
    names.set(userId, username);
    this.memNames.set(day, names);
  }

  async addScore(userId: string, username: string, points: number, day = today()) {
    if (points <= 0) return this.scoreOf(userId, day);
    await this.safe(
      async (redis) => {
        await redis.zincrby(boardKey(day), points, userId);
        await redis.hset(nameKey(day), userId, username);
        await redis.expire(boardKey(day), 3 * 86400);
        await redis.expire(nameKey(day), 3 * 86400);
      },
      () => this.memAdd(userId, username, points, day),
    );
    return this.scoreOf(userId, day);
  }

  async scoreOf(userId: string, day = today()): Promise<number> {
    return this.safe(
      async (redis) => Number((await redis.zscore(boardKey(day), userId)) ?? 0),
      () => this.mem.get(day)?.get(userId) ?? 0,
    );
  }

  /** Top entries with usernames resolved from the Redis hash / memory map. */
  async topWithNames(day = today(), limit = 10): Promise<BoardEntry[]> {
    const rows = await this.safe(
      async (redis) => {
        const raw = await redis.zrevrange(boardKey(day), 0, limit - 1, 'WITHSCORES');
        const out: Array<[string, number]> = [];
        for (let i = 0; i < raw.length; i += 2) out.push([raw[i], Number(raw[i + 1])]);
        return out;
      },
      () => this.memTop(day, limit),
    );
    const names = await this.safe(
      async (redis) => (await redis.hgetall(nameKey(day))) as Record<string, string>,
      () => {
        const out: Record<string, string> = {};
        this.memNames.get(day)?.forEach((v, k) => (out[k] = v));
        return out;
      },
    );
    return rows.map(([userId, score], i) => ({
      rank: i + 1,
      userId,
      username: names[userId] ?? userId.slice(0, 8),
      score,
    }));
  }

  private memTop(day: string, limit: number): Array<[string, number]> {
    return [...(this.mem.get(day)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, limit);
  }

  async rankOf(userId: string, day = today()): Promise<{ rank: number | null; score: number }> {
    const score = await this.scoreOf(userId, day);
    if (score <= 0) return { rank: null, score: 0 };
    const rank = await this.safe(
      async (redis) => await redis.zrevrank(boardKey(day), userId),
      () => {
        const board = [...(this.mem.get(day)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
        const idx = board.findIndex(([id]) => id === userId);
        return idx === -1 ? null : idx;
      },
    );
    return { rank: rank === null ? null : rank + 1, score };
  }

  /** Persist a day's board, computed from attempts (source of truth) with accuracy. */
  async snapshot(day = today()) {    const rows = (await this.attempts
      .aggregate([
        { $match: { day_bucket: day } },
        {
          $group: {
            _id: '$user_id',
            score: { $sum: '$points_awarded' },
            attempts: { $sum: 1 },
            correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
          },
        },
        { $sort: { score: -1, _id: 1 } },
        { $limit: 1000 },
      ])
      .exec()) as Array<{ _id: string; score: number; attempts: number; correct: number }>;

    const ids = rows.map((r) => r._id);
    const users = await this.users
      .find({ $or: [{ clerkId: { $in: ids } }] })
      .select('clerkId username')
      .lean()
      .exec();
    const names = new Map(users.map((u) => [u.clerkId, u.username ?? u.clerkId.slice(0, 8)]));
    // Backfill Redis-only names for users missing a DB row (dev bypass etc.).
    if (this.redis) {
      try {
        const hashes = await this.redis.hgetall(nameKey(day));
        for (const [k, v] of Object.entries(hashes)) if (!names.has(k)) names.set(k, v);
      } catch { /* ignore */ }
    }

    const entries = rows.map((r, i) => ({
      user_id: r._id,
      username: names.get(r._id) ?? r._id.slice(0, 8),
      rank: i + 1,
      score: r.score,
      accuracy: r.attempts ? r.correct / r.attempts : 0,
    }));
    await this.snapshots
      .findOneAndUpdate(
        { period_type: 'daily', period_key: day },
        { period_type: 'daily', period_key: day, entries },
        { upsert: true, new: true },
      )
      .exec();
    return { day, entries: entries.length };
  }

  /**
   * Daily hardest-questions board: the 10 toughest questions attempted since
   * `since` (YYYY-MM-DD, default today), ranked by difficulty then volume,
   * with a truncated prompt so the board reads as a daily challenge feed.
   *
   * Design notes:
   * - Difficulty is denormalised on `attempts` (spec §3), so ranking needs no
   *   $lookup; only the surviving page of prompts is fetched afterwards.
   * - Prompts are truncated here; the correct answer and explanation are never
   *   included, so the quota'd practice loop stays the only way to answer.
   * - `since` is validated by the controller; aggregation stays index-bounded.
   */
  async hardestQuestions(since = today(), limit = 10): Promise<HardQuestionEntry[]> {
    const cap = Math.min(Math.max(limit, 1), 50);
    const rows = (await this.attempts
      .aggregate([
        { $match: { day_bucket: { $gte: since } } },
        {
          $group: {
            _id: '$question_id',
            topic: { $last: '$topic' },
            difficulty: { $last: '$difficulty' },
            day: { $min: '$day_bucket' },
            attemptCount: { $sum: 1 },
            correctCount: { $sum: { $cond: ['$is_correct', 1, 0] } },
          },
        },
        // Prefer the most-attempted questions to survive the candidate cap.
        { $sort: { attemptCount: -1, _id: 1 } },
        { $limit: 200 },
      ])
      .exec()) as Array<{
      _id: Types.ObjectId;
      topic: string;
      difficulty: 'easy' | 'medium' | 'hard';
      day: string;
      attemptCount: number;
      correctCount: number;
    }>;

    const ranked = rankHardQuestions(
      rows.map((r) => ({
        questionId: String(r._id),
        topic: r.topic,
        difficulty: r.difficulty,
        day: r.day,
        attemptCount: r.attemptCount,
        correctCount: r.correctCount,
      })),
      cap,
    );

    const prompts = new Map<string, string>();
    if (ranked.length > 0) {
      const docs = await this.questions
        .find({ _id: { $in: ranked.map((r) => r.questionId) } })
        .select('prompt')
        .lean()
        .exec();
      for (const d of docs) prompts.set(String(d._id), d.prompt ?? '');
    }

    return ranked.map((r) => ({
      ...r,
      prompt: prompts.get(r.questionId)?.slice(0, 160),
    }));
  }

  /** A user's rank/score/accuracy trail across persisted snapshots. */
  async userHistory(userId: string, days = 30): Promise<HistoryPoint[]> {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86400000)
      .toISOString()
      .slice(0, 10);
    const snaps = await this.snapshots
      .find({ period_type: 'daily', period_key: { $gte: since } })
      .sort({ period_key: 1 })
      .lean()
      .exec();
    return snaps.map((s) => {
      const me = s.entries.find((e) => e.user_id === userId);
      return {
        day: s.period_key,
        rank: me?.rank ?? null,
        score: me?.score ?? 0,
        accuracy: me?.accuracy ?? null,
        of: s.entries.length,
      };
    });
  }

  /** Persisted board for a past date (top-N + caller's own entry). */
  async dayBoard(date: string, userId: string | null, limit = 50) {
    const snap = await this.snapshots
      .findOne({ period_type: 'daily', period_key: date })
      .lean()
      .exec();
    if (!snap) return { day: date, entries: [], mine: null, snapshot: false };
    const entries = snap.entries.slice(0, Math.min(Math.max(limit, 1), 100)).map((e) => ({
      rank: e.rank,
      userId: e.user_id,
      username: e.username,
      score: e.score,
    }));
    const mine = userId ? (snap.entries.find((e) => e.user_id === userId) ?? null) : null;
    return {
      day: date,
      entries,
      mine: mine ? { rank: mine.rank, score: mine.score, accuracy: mine.accuracy, of: snap.entries.length } : null,
      snapshot: true,
    };
  }
}
