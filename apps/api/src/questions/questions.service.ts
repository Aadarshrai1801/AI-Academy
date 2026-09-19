import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import { Question, QuestionDocument } from './question.schema.js';
import { Attempt, AttemptDocument } from '../attempts/attempt.schema.js';
import { SEED_QUESTIONS } from './seed.data.js';
import { EntitlementsService, Role } from '../common/entitlements.service.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { TOPIC_IDS } from '../curriculum/curriculum.js';
import { MasteryService } from '../mastery/mastery.service.js';
import { envBool } from '../config.js';

export interface NextQuery {
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
}

type Difficulty = NonNullable<NextQuery['difficulty']>;

/**
 * Question serving (spec §2.1).
 * - Serves from the approved bank, excluding questions the user has seen.
 * - Serving is free: the daily practice budget is consumed on the FIRST
 *   graded attempt per question per day (see AttemptsService.submit), so
 *   merely viewing, refreshing, or abandoning a question never spends it.
 * - correct_answer is NEVER returned here (schema select:false + manual strip
 *   on aggregate paths); the client learns it only via POST /attempts.
 */
@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(Attempt.name) private readonly attempts: Model<AttemptDocument>,
    private readonly entitlements: EntitlementsService,
    private readonly curriculum: CurriculumService,
    private readonly mastery: MasteryService,
  ) {}

  async topics() {
    const rows = await this.questions
      .aggregate([
        { $match: { quality_status: 'approved' } },
        { $group: { _id: { topic: '$topic', difficulty: '$difficulty' }, count: { $sum: 1 } } },
      ])
      .exec();
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows as Array<{ _id: { topic: string; difficulty: string }; count: number }>) {
      out[r._id.topic] ??= {};
      out[r._id.topic][r._id.difficulty] = r.count;
    }
    return out;
  }

  count() {
    return this.questions.countDocuments({ quality_status: 'approved' }).exec();
  }

  async next(userId: string, role: Role, query: NextQuery) {
    const explicitDifficulty = query.difficulty;
    if (explicitDifficulty === 'hard') {
      const h = await this.entitlements.check(userId, role, 'hard_questions');
      if (!h.allowed) {
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Hard difficulty teaser exhausted',
            feature: 'hard_questions',
            limit: h.limit,
            resetAt: this.entitlements.resetAt('hard_questions'),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const match: Record<string, unknown> = { quality_status: 'approved' };
    if (explicitDifficulty) match.difficulty = explicitDifficulty;

    let allowedTopics: string[];
    if (query.topic) {
      // Explicit topic: surface an actionable 403 when it is still locked.
      await this.curriculum.assertTopicAccess(userId, role, query.topic);
      match.topic = query.topic;
      allowedTopics = [query.topic];
    } else {
      // Random serve: never leak questions from gated topics.
      const locked = await this.curriculum.lockedTopics(userId, role);
      if (locked.length > 0) match.topic = { $nin: locked };
      allowedTopics = TOPIC_IDS.filter((t) => !locked.includes(t));
    }

    // Adaptive difficulty (Phase 13): when the caller pins no difficulty, aim
    // each allowed topic at the learner's mastery band (default easy when the
    // topic has no history). Free tier is capped at medium so the explicit
    // hard-teaser gate keeps its meaning; admins keep unfiltered access.
    let adaptive = false;
    if (!explicitDifficulty && role !== 'admin' && this.adaptiveEnabled()) {
      const targets = await this.recommendedTargets(userId, role, allowedTopics);
      if (targets.size > 0) {
        if (query.topic) {
          match.difficulty = targets.get(query.topic)!;
        } else {
          match.$or = [...targets.entries()].map(([topic, difficulty]) => ({ topic, difficulty }));
        }
        adaptive = true;
      }
    }

    const seen = await this.attempts
      .find({ user_id: userId })
      .select('question_id')
      .sort({ _id: -1 })
      .limit(500)
      .lean()
      .exec();
    const seenIds = seen.map((s) => new mongoose.Types.ObjectId(String(s.question_id)));

    // If the adaptive constraint has no bank coverage, relax it before the
    // final repeat-serve fallback so a thin (topic × difficulty) cell can
    // never turn into a spurious 404.
    const relaxed: Record<string, unknown> = { ...match };
    if (adaptive) {
      delete relaxed.$or;
      delete relaxed.difficulty;
    }

    let adaptiveApplied = adaptive;
    let docs = await this.questions
      .aggregate([{ $match: { ...match, _id: { $nin: seenIds } } }, { $sample: { size: 1 } }])
      .exec();
    let repeated = false;
    if (docs.length === 0 && adaptive) {
      docs = await this.questions
        .aggregate([{ $match: { ...relaxed, _id: { $nin: seenIds } } }, { $sample: { size: 1 } }])
        .exec();
      adaptiveApplied = false;
    }
    if (docs.length === 0) {
      docs = await this.questions.aggregate([{ $match: relaxed }, { $sample: { size: 1 } }]).exec();
      repeated = true;
      adaptiveApplied = false;
    }
    if (docs.length === 0) {
      throw new HttpException(
        { statusCode: 404, error: 'No questions for this filter yet' },
        HttpStatus.NOT_FOUND,
      );
    }

    const q = docs[0] as Record<string, unknown> & { _id: mongoose.Types.ObjectId };
    // Serving spends nothing (see class docstring). The hard-teaser gate is
    // the only serve-side budget: hard questions stay preview-limited even
    // though viewing is otherwise free. Adaptive serving never picks hard for
    // free tier, so this only fires for explicit hard requests (and pro/admin).
    if (explicitDifficulty === 'hard') {
      await this.entitlements.consumeOrThrow(userId, role, 'hard_questions');
    }
    await this.questions.updateOne({ _id: q._id }, { $inc: { times_served: 1 } }).exec();

    return {
      id: String(q._id),
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      repeated,
      adaptive: adaptiveApplied,
    };
  }

  private adaptiveEnabled(): boolean {
    return envBool('ADAPTIVE_DIFFICULTY', true);
  }

  /** Per-topic difficulty targets for serving (free tier never auto-hard). */
  private async recommendedTargets(
    userId: string,
    role: Role,
    topics: string[],
  ): Promise<Map<string, Difficulty>> {
    let recommended = new Map<string, Difficulty>();
    try {
      recommended = await this.mastery.recommendedByTopic(userId);
    } catch {
      // Mastery is a serving enhancement — never block practice if it fails.
      recommended = new Map();
    }
    const targets = new Map<string, Difficulty>();
    for (const topic of topics) {
      let difficulty = recommended.get(topic) ?? 'easy';
      if (role === 'free' && difficulty === 'hard') difficulty = 'medium';
      targets.set(topic, difficulty);
    }
    return targets;
  }

  /** Serve a specific question (group challenge flow) — free like all serves. */
  async byId(userId: string, role: Role, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const q = await this.questions.findOne({ _id: id, quality_status: 'approved' }).exec();
    if (!q) {
      throw new HttpException({ statusCode: 404, error: 'Question not found' }, HttpStatus.NOT_FOUND);
    }
    // Same learning-path gate as next(): deep links cannot bypass it.
    await this.curriculum.assertTopicAccess(userId, role, q.topic);
    if (q.difficulty === 'hard') {
      await this.entitlements.consumeOrThrow(userId, role, 'hard_questions');
    }
    await this.questions.updateOne({ _id: q._id }, { $inc: { times_served: 1 } }).exec();
    return {
      id: String(q._id),
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      repeated: false,
    };
  }

  /**
   * Sample up to `count` approved questions for a topic without answers —
   * used by the video end-of-playlist check and similar lightweight prompts.
   * Serving is free (no quota); hard questions are excluded so the
   * hard-teaser gate is never bypassed.
   */
  async sampleForTopic(
    userId: string,
    role: Role,
    topic: string,
    count = 2,
    excludeIds: string[] = [],
  ) {
    await this.curriculum.assertTopicAccess(userId, role, topic);
    const exclude = excludeIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const match: Record<string, unknown> = {
      topic,
      quality_status: 'approved',
      difficulty: { $ne: 'hard' },
    };
    if (exclude.length > 0) match._id = { $nin: exclude };
    const rows = await this.questions
      .aggregate([{ $match: match }, { $sample: { size: Math.min(Math.max(count, 1), 5) } }])
      .exec();
    return (rows as Array<Record<string, unknown>>).map((q) => ({
      id: String(q._id),
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
    }));
  }

  /** Idempotent seed: inserts only prompts not already present. */
  async seedIfEmpty(requesterRole: Role) {
    const count = await this.questions.estimatedDocumentCount().exec();
    if (count > 0 && requesterRole !== 'admin') {
      throw new HttpException(
        { statusCode: 409, error: 'Bank already seeded (admins may top up)' },
        HttpStatus.CONFLICT,
      );
    }
    const existing = new Set(
      (await this.questions.find({}).select('prompt').lean().exec()).map((q) => q.prompt),
    );
    const fresh = SEED_QUESTIONS.filter((q) => !existing.has(q.prompt));
    if (fresh.length > 0) {
      await this.questions.insertMany(
        fresh.map((q) => ({ ...q, source: 'seed', quality_status: 'approved' })),
        { ordered: false },
      );
    }
    return { inserted: fresh.length, total: count + fresh.length };
  }
}
