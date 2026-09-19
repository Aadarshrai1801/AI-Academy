import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import { TopicMastery, TopicMasteryDocument } from './topic-mastery.schema.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';
import { User, UserDocument } from '../users/user.schema.js';
import { envFloat, envInt } from '../config.js';
import { gradeAnswer } from '../common/grading.js';
import { TOPIC_IDS, isTopicId, type TopicId } from '../curriculum/curriculum.js';

/**
 * Onboarding diagnostic blueprint: 8 questions — two per foundation topic
 * (easy + medium) and one easy per intermediate/advanced topic. Spans every
 * topic and two difficulty tiers without front-loading hard questions.
 */
const DIAGNOSTIC_BLUEPRINT: Array<{ topic: TopicId; difficulty: 'easy' | 'medium' | 'hard' }> = [
  { topic: 'ml-basics', difficulty: 'easy' },
  { topic: 'ml-basics', difficulty: 'medium' },
  { topic: 'statistics', difficulty: 'easy' },
  { topic: 'statistics', difficulty: 'medium' },
  { topic: 'neural-networks', difficulty: 'easy' },
  { topic: 'deep-learning', difficulty: 'easy' },
  { topic: 'llms', difficulty: 'easy' },
  { topic: 'evaluation', difficulty: 'easy' },
];

/** Correct answers gain faster on hard questions, slower on easy ones. */
const DIFFICULTY_GAIN: Record<string, number> = { easy: 0.7, medium: 1, hard: 1.3 };

const DIAGNOSTIC_MIN_SEED = 20;
const DIAGNOSTIC_MAX_SEED = 65;

export interface MasteryAttemptUpdate {
  topic: string;
  difficulty: string;
  isCorrect: boolean;
  /** Reveal-assisted same-day retries never move mastery. */
  isRetry: boolean;
  hintUsed?: boolean;
}

export interface MasteryTopicView {
  topic: string;
  score: number | null;
  rawScore: number | null;
  attempts: number;
  correct: number;
  accuracy: number | null;
  lastPracticedAt: string | null;
  source: 'diagnostic' | 'attempts' | null;
  recommendedDifficulty: 'easy' | 'medium' | 'hard' | null;
  /** Daily scores (oldest first, max 14) — the /progress trajectory. */
  trend: number[];
  /** Score change across the stored window; null when there is no history. */
  weekChange: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Keep one score per day, newest last, capped at 14 entries. */
function pushHistory(
  history: Array<{ day: string; score: number }> | undefined,
  day: string,
  score: number,
): Array<{ day: string; score: number }> {
  const rows = (history ?? []).filter((h) => h.day !== day);
  rows.push({ day, score: Math.round(score * 10) / 10 });
  return rows.slice(-14);
}

/**
 * Adaptive mastery tracking (Phase 9).
 *
 * Score model: per-attempt EMA `α` (`MASTERY_EMA_ALPHA`, default 0.2) with a
 * difficulty multiplier, hint-assisted gains halved and hint-assisted misses
 * penalised harder. Reads apply exponential decay from the last update
 * (`MASTERY_DECAY_HALF_LIFE_DAYS`, default 30) so stale mastery fades without
 * a background job. The stored score is authoritative; decay is presentation.
 *
 * The score is separate from points/streaks: it never affects scoring, and
 * the prerequisite gate in `curriculum` keeps its own consecutive-correct
 * rule. `recommendedDifficulty` is the adaptive-difficulty signal for the UI.
 */
@Injectable()
export class MasteryService {
  constructor(
    @InjectModel(TopicMastery.name) private readonly mastery: Model<TopicMasteryDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  alpha(): number {
    return envFloat('MASTERY_EMA_ALPHA', 0.2, { min: 0.05, max: 0.6 });
  }

  decayHalfLifeDays(): number {
    return envInt('MASTERY_DECAY_HALF_LIFE_DAYS', 30);
  }

  /** Exponential decay of a stored score by age (half-life from env). */
  decayedScore(score: number, updatedAt?: Date | null): number {
    if (!updatedAt) return score;
    const days = Math.max(0, (Date.now() - updatedAt.getTime()) / 86_400_000);
    return score * Math.pow(0.5, days / this.decayHalfLifeDays());
  }

  recommendedDifficulty(score: number): 'easy' | 'medium' | 'hard' {
    if (score < 40) return 'easy';
    if (score < 70) return 'medium';
    return 'hard';
  }

  /**
   * Lightweight per-topic difficulty map for question serving (Phase 13):
   * topics without a record are absent (the caller applies its own default).
   */
  async recommendedByTopic(userId: string): Promise<Map<string, 'easy' | 'medium' | 'hard'>> {
    const records = await this.mastery
      .find({ user_id: userId })
      .select('topic score updated_at created_at')
      .lean()
      .exec();
    const out = new Map<string, 'easy' | 'medium' | 'hard'>();
    for (const record of records) {
      const effective = this.decayedScore(
        record.score,
        record.updated_at ?? record.created_at ?? null,
      );
      out.set(record.topic, this.recommendedDifficulty(effective));
    }
    return out;
  }

  /**
   * Apply one graded attempt to the topic's mastery (best-effort in the
   * submit path — callers swallow failures so grading never breaks).
   */
  async recordAttempt(userId: string, update: MasteryAttemptUpdate): Promise<void> {
    if (update.isRetry) return;
    const alpha = this.alpha();
    const gain = DIFFICULTY_GAIN[update.difficulty] ?? 1;

    const existing = await this.mastery.findOne({ user_id: userId, topic: update.topic }).exec();
    if (!existing) {
      const start = update.isCorrect ? Math.min(100, alpha * 100 * gain) : 0;
      await this.mastery
        .updateOne(
          { user_id: userId, topic: update.topic },
          {
            $setOnInsert: {
              score: start,
              source: 'attempts',
              attempts_counted: 1,
              correct_counted: update.isCorrect ? 1 : 0,
              history: [{ day: new Date().toISOString().slice(0, 10), score: round1(start) }],
            },
          },
          { upsert: true },
        )
        .exec();
      return;
    }

    const current = existing.score ?? 0;
    let next: number;
    if (update.isCorrect) {
      const factor = update.hintUsed ? 0.5 : gain;
      next = current + alpha * (100 - current) * factor;
    } else {
      next = current - alpha * current * (update.hintUsed ? 1.25 : 1);
    }
    existing.score = Math.max(0, Math.min(100, next));
    existing.attempts_counted = (existing.attempts_counted ?? 0) + 1;
    if (update.isCorrect) existing.correct_counted = (existing.correct_counted ?? 0) + 1;
    existing.history = pushHistory(existing.history, new Date().toISOString().slice(0, 10), existing.score);
    await existing.save();
  }

  /** Learner dashboard: per-topic mastery in curriculum order. */
  async summary(userId: string) {
    const [records, user] = await Promise.all([
      this.mastery.find({ user_id: userId }).lean().exec(),
      this.users
        .findOne({ clerkId: userId })
        .select('onboarding_diagnostic_completed_at')
        .lean()
        .exec(),
    ]);
    const byTopic = new Map(records.map((r) => [r.topic, r]));

    const topics: MasteryTopicView[] = TOPIC_IDS.map((topic) => {
      const record = byTopic.get(topic);
      if (!record) {
        return {
          topic,
          score: null,
          rawScore: null,
          attempts: 0,
          correct: 0,
          accuracy: null,
          lastPracticedAt: null,
          source: null,
          recommendedDifficulty: null,
          trend: [],
          weekChange: null,
        };
      }
      const effective = this.decayedScore(record.score, record.updated_at ?? record.created_at ?? null);
      const trend = (record.history ?? []).map((h) => round1(h.score));
      return {
        topic,
        score: round1(effective),
        rawScore: round1(record.score),
        attempts: record.attempts_counted ?? 0,
        correct: record.correct_counted ?? 0,
        accuracy:
          (record.attempts_counted ?? 0) > 0
            ? (record.correct_counted ?? 0) / record.attempts_counted!
            : null,
        lastPracticedAt: (record.updated_at ?? record.created_at)?.toISOString() ?? null,
        source: record.source ?? null,
        recommendedDifficulty: this.recommendedDifficulty(effective),
        trend,
        weekChange: trend.length >= 2 ? round1(effective - trend[0]) : null,
      };
    });

    const scored = topics.filter((t): t is MasteryTopicView & { score: number } => t.score !== null);
    return {
      topics,
      overall:
        scored.length > 0
          ? round1(scored.reduce((sum, t) => sum + t.score, 0) / scored.length)
          : null,
      decayHalfLifeDays: this.decayHalfLifeDays(),
      diagnosticCompleted: Boolean(user?.onboarding_diagnostic_completed_at),
    };
  }

  /**
   * Start (or resume) the onboarding diagnostic. Idempotent per user: the
   * sampled question ids are stored until submitted. Serving the diagnostic is
   * free — it does not consume practice quota.
   */
  async startOrResumeDiagnostic(userId: string) {
    const user = await this.users
      .findOne({ clerkId: userId })
      .select('onboarding_diagnostic_completed_at onboarding_diagnostic_question_ids')
      .lean()
      .exec();
    if (user?.onboarding_diagnostic_completed_at) {
      return { completed: true as const, completedAt: user.onboarding_diagnostic_completed_at };
    }

    let ids = (user?.onboarding_diagnostic_question_ids ?? []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
    if (ids.length > 0) {
      const resumed = await this.loadDiagnosticQuestions(ids);
      if (resumed.length > 0) return { completed: false as const, questions: resumed };
    }

    ids = await this.sampleDiagnosticQuestionIds();
    if (ids.length === 0) {
      throw new NotFoundException('Question bank is empty — seed questions before onboarding');
    }
    await this.users
      .updateOne(
        { clerkId: userId },
        { $set: { onboarding_diagnostic_question_ids: ids } },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return { completed: false as const, questions: await this.loadDiagnosticQuestions(ids) };
  }

  /** Grade the diagnostic and seed per-topic mastery (only where none exists). */
  async submitDiagnostic(
    userId: string,
    answers: Array<{ questionId: string; answer: string }>,
  ) {
    const user = await this.users
      .findOne({ clerkId: userId })
      .select('onboarding_diagnostic_completed_at onboarding_diagnostic_question_ids')
      .lean()
      .exec();
    if (user?.onboarding_diagnostic_completed_at) {
      throw new ConflictException('Diagnostic already completed');
    }
    const stored = new Set((user?.onboarding_diagnostic_question_ids ?? []).map(String));
    if (stored.size === 0) {
      throw new BadRequestException('Start the diagnostic first (GET /mastery/diagnostic)');
    }
    const accepted = answers.filter((a) => stored.has(a.questionId));
    if (accepted.length === 0) {
      throw new BadRequestException('No answers matched this diagnostic session');
    }

    const rows = await this.questions
      .find({ _id: { $in: accepted.map((a) => a.questionId) } })
      .select('+correct_answer')
      .lean()
      .exec();
    const byId = new Map(rows.map((q) => [String(q._id), q]));

    const perTopic = new Map<string, { correct: number; total: number }>();
    let correct = 0;
    for (const answer of accepted) {
      const q = byId.get(answer.questionId);
      if (!q) continue;
      const ok = gradeAnswer(q.type, q.correct_answer, answer.answer);
      if (ok) correct += 1;
      const bucket = perTopic.get(q.topic) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (ok) bucket.correct += 1;
      perTopic.set(q.topic, bucket);
    }

    const seeded: Array<{ topic: string; seedScore: number; correct: number; total: number }> = [];
    for (const [topic, bucket] of perTopic) {
      if (!isTopicId(topic)) continue;
      const accuracy = bucket.total > 0 ? bucket.correct / bucket.total : 0;
      const seedScore = Math.round(
        DIAGNOSTIC_MIN_SEED + (DIAGNOSTIC_MAX_SEED - DIAGNOSTIC_MIN_SEED) * accuracy,
      );
      const res = await this.mastery
        .updateOne(
          { user_id: userId, topic },
          {
            $setOnInsert: {
              score: seedScore,
              source: 'diagnostic',
              attempts_counted: bucket.total,
              correct_counted: bucket.correct,
              history: [{ day: new Date().toISOString().slice(0, 10), score: seedScore }],
            },
          },
          { upsert: true },
        )
        .exec();
      // Only report topics that were actually seeded (existing practice
      // progress is never overwritten by the diagnostic).
      if (res.upsertedCount > 0) {
        seeded.push({ topic, seedScore, correct: bucket.correct, total: bucket.total });
      }
    }

    await this.users
      .updateOne(
        { clerkId: userId },
        {
          $set: { onboarding_diagnostic_completed_at: new Date() },
          $unset: { onboarding_diagnostic_question_ids: 1 },
        },
      )
      .exec();

    return {
      completed: true as const,
      correct,
      total: accepted.length,
      accuracy: accepted.length > 0 ? correct / accepted.length : null,
      seeded,
    };
  }

  /** Sample one approved question per blueprint slot (difficulty fallback). */
  private async sampleDiagnosticQuestionIds(): Promise<string[]> {
    const picks = await Promise.all(
      DIAGNOSTIC_BLUEPRINT.map(async (slot) => {
        const sample = async (match: Record<string, unknown>) => {
          const rows = await this.questions
            .aggregate([
              { $match: { ...match, quality_status: 'approved' } },
              { $sample: { size: 1 } },
              { $project: { _id: 1 } },
            ])
            .exec();
          const id = (rows[0] as { _id?: unknown } | undefined)?._id;
          return id ? String(id) : null;
        };
        return (
          (await sample({ topic: slot.topic, difficulty: slot.difficulty })) ??
          (await sample({ topic: slot.topic }))
        );
      }),
    );
    return [...new Set(picks.filter((id): id is string => Boolean(id)))];
  }

  /** Load diagnostic questions in blueprint order, never leaking answers. */
  private async loadDiagnosticQuestions(ids: string[]) {
    const rows = await this.questions
      .find({ _id: { $in: ids }, quality_status: 'approved' })
      .select('-correct_answer')
      .lean()
      .exec();
    const byId = new Map(rows.map((q) => [String(q._id), q]));
    return ids
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => ({
        id: String(q._id),
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
      }));
  }
}
