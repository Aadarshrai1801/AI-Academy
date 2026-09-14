import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Attempt, AttemptDocument } from './attempt.schema.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';
import { User, UserDocument } from '../users/user.schema.js';
import { Streak, StreakDocument } from '../streaks/streak.schema.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { withTransaction } from '../common/mongo-transaction.js';

/**
 * Attempt grading + scoring (spec §2.1).
 * Points = base(difficulty) × speed multiplier; incorrect = 0.
 * Mirrors @ai-academy/shared pointsForAttempt/gradeAnswer (single service copy
 * until workspaces are linked in a later phase).
 */
const BASE_POINTS = { easy: 10, medium: 25, hard: 50 } as const;
const FAST_THRESHOLD_MS = 30_000;
const FAST_MULTIPLIER = 1.5;
const MIN_TIME_MS = 1000; // anti-cheat: reject impossibly fast submissions

function grade(type: string, correct: string, submitted: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (type === 'mcq') return norm(submitted) === norm(correct);
  if (!norm(submitted)) return false;
  return norm(correct).includes(norm(submitted)) || norm(submitted).includes(norm(correct));
}

@Injectable()
export class AttemptsService {
  constructor(
    @InjectModel(Attempt.name) private readonly attempts: Model<AttemptDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Streak.name) private readonly streaks: Model<StreakDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly streaksService: StreaksService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  async submit(userId: string, input: { questionId: string; answer: string; timeTakenMs: number }) {
    if (!Types.ObjectId.isValid(input.questionId)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid questionId' }, HttpStatus.BAD_REQUEST);
    }
    if (input.timeTakenMs < MIN_TIME_MS) {
      throw new HttpException(
        { statusCode: 400, error: `timeTakenMs below minimum (${MIN_TIME_MS}ms)` },
        HttpStatus.BAD_REQUEST,
      );
    }

    const q = await this.questions.findById(input.questionId).select('+correct_answer').exec();
    if (!q || q.quality_status !== 'approved') {
      throw new HttpException({ statusCode: 404, error: 'Question not found' }, HttpStatus.NOT_FOUND);
    }

    const isCorrect = grade(q.type, q.correct_answer, input.answer);
    const base = BASE_POINTS[q.difficulty];
    const points = isCorrect ? Math.round(base * (input.timeTakenMs <= FAST_THRESHOLD_MS ? FAST_MULTIPLIER : 1)) : 0;
    const day = new Date().toISOString().slice(0, 10);

    // Atomic where supported (Atlas / replica set): attempt + question stats +
    // user points + streak all commit together, so a mid-flight failure cannot
    // leave points/streaks drifted. Standalone Mongo falls back to sequential.
    const { attempt, streak } = await withTransaction(this.connection, async (session) => {
      const [created] = await this.attempts.create(
        [
          {
            user_id: userId,
            question_id: q._id,
            difficulty: q.difficulty,
            topic: q.topic,
            submitted_answer: input.answer,
            is_correct: isCorrect,
            time_taken_ms: input.timeTakenMs,
            points_awarded: points,
            day_bucket: day,
          },
        ],
        session ? { session } : {},
      );
      await this.questions
        .updateOne({ _id: q._id }, { $inc: { times_correct: isCorrect ? 1 : 0 } }, session ? { session } : {})
        .exec();

      await this.users
        .findOneAndUpdate(
          { clerkId: userId },
          { $inc: { points_total: points } },
          { upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) },
        )
        .exec();

      const recorded = await this.streaksService.recordAttempt(userId, session);
      return { attempt: created, streak: recorded };
    });

    // Redis leaderboard sits outside the Mongo transaction (different store);
    // it is derived state and can be rebuilt from attempts if it drifts.
    const dailyScore = await this.leaderboard.addScore(
      userId,
      (await this.users.findOne({ clerkId: userId }).select('username').lean().exec())?.username ??
        userId.slice(0, 8),
      points,
      day,
    );

    return {
      attemptId: String(attempt._id),
      isCorrect,
      pointsAwarded: points,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      dailyScore,
      streak,
    };
  }

  history(userId: string, limit = 20, day?: string) {
    const filter: Record<string, unknown> = { user_id: userId };
    if (day) filter.day_bucket = day;
    return this.attempts
      .find(filter)
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec()
      .then((rows) =>
        rows.map((a) => ({
          id: String(a._id),
          questionId: String(a.question_id),
          difficulty: a.difficulty,
          topic: a.topic,
          isCorrect: a.is_correct,
          points: a.points_awarded,
          timeTakenMs: a.time_taken_ms,
          day: a.day_bucket,
          at: a.created_at,
        })),
      );
  }

  async remove(userId: string, id: string) {
    const res = await this.attempts.deleteOne({ _id: id, user_id: userId }).exec();
    return { deleted: res.deletedCount > 0 };
  }

  async clearHistory(userId: string) {
    const res = await this.attempts.deleteMany({ user_id: userId }).exec();
    return { cleared: true, count: res.deletedCount };
  }

  async summary(userId: string) {
    const day = new Date().toISOString().slice(0, 10);
    const [todayRows, user, streakDoc, rank] = await Promise.all([
      this.attempts.find({ user_id: userId, day_bucket: day }).select('is_correct points_awarded').lean().exec(),
      this.users.findOne({ clerkId: userId }).select('points_total current_streak longest_streak role username').lean().exec(),
      this.streaks.findOne({ user_id: userId, date: day }).lean().exec(),
      this.leaderboard.rankOf(userId, day),
    ]);
    const todayScore = todayRows.reduce((s, r) => s + r.points_awarded, 0);
    const todayCorrect = todayRows.filter((r) => r.is_correct).length;
    return {
      today: {
        attempts: todayRows.length,
        correct: todayCorrect,
        score: todayScore,
        accuracy: todayRows.length ? todayCorrect / todayRows.length : null,
      },
      total: { points: user?.points_total ?? 0 },
      streak: {
        current: user?.current_streak ?? 0,
        longest: user?.longest_streak ?? 0,
        todayCount: streakDoc?.activity_count ?? 0,
      },
      rank,
      role: user?.role ?? 'free',
      username: user?.username ?? null,
    };
  }

  /**
   * Personal analytics (spec §1, §7): daily series + per-topic breakdown.
   * Pro also gets comparative context (rank, field size, percentile, avg score).
   */
  async analytics(userId: string, role: 'free' | 'pro' | 'admin', days = 30) {
    const n = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

    const [daily, topics, totals] = await Promise.all([
      this.attempts
        .aggregate([
          { $match: { user_id: userId, day_bucket: { $gte: since } } },
          {
            $group: {
              _id: '$day_bucket',
              attempts: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
              score: { $sum: '$points_awarded' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
      this.attempts
        .aggregate([
          { $match: { user_id: userId } },
          {
            $group: {
              _id: '$topic',
              attempts: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
              score: { $sum: '$points_awarded' },
            },
          },
          { $sort: { attempts: -1 } },
        ])
        .exec(),
      this.attempts
        .aggregate([
          { $match: { user_id: userId } },
          {
            $group: {
              _id: null,
              attempts: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
              score: { $sum: '$points_awarded' },
            },
          },
        ])
        .exec(),
    ]);

    const out: Record<string, unknown> = {
      daily: (daily as Array<{ _id: string; attempts: number; correct: number; score: number }>).map((d) => ({
        day: d._id,
        attempts: d.attempts,
        correct: d.correct,
        score: d.score,
        accuracy: d.attempts ? d.correct / d.attempts : null,
      })),
      topics: (topics as Array<{ _id: string; attempts: number; correct: number; score: number }>).map((t) => ({
        topic: t._id,
        attempts: t.attempts,
        correct: t.correct,
        score: t.score,
        accuracy: t.attempts ? t.correct / t.attempts : null,
      })),
      totals: (() => {
        const t = (totals as Array<{ attempts: number; correct: number; score: number }>)[0];
        if (!t) return { attempts: 0, correct: 0, score: 0, accuracy: null };
        return { attempts: t.attempts, correct: t.correct, score: t.score, accuracy: t.correct / t.attempts };
      })(),
    };

    if (role !== 'free') {
      const day = new Date().toISOString().slice(0, 10);
      const [rank, field] = await Promise.all([
        this.leaderboard.rankOf(userId, day),
        this.attempts
          .aggregate([
            { $match: { day_bucket: day } },
            { $group: { _id: null, users: { $addToSet: '$user_id' }, totalScore: { $sum: '$points_awarded' } } },
          ])
          .exec() as Promise<Array<{ users: string[]; totalScore: number }>>,
      ]);
      const of = field[0]?.users.length ?? 0;
      out.compare = {
        rank: rank.rank,
        of,
        percentile: rank.rank !== null && of > 1 ? Math.round(((of - rank.rank) / (of - 1)) * 100) : rank.rank === 1 ? 100 : null,
        avgScoreToday: of ? Math.round((field[0]?.totalScore ?? 0) / of) : null,
      };
    }
    return out;
  }
}
