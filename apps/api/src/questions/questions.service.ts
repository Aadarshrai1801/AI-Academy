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

export interface NextQuery {
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
}

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
    if (query.difficulty === 'hard') {
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
    if (query.difficulty) match.difficulty = query.difficulty;
    if (query.topic) match.topic = query.topic;

    const seen = await this.attempts
      .find({ user_id: userId })
      .select('question_id')
      .sort({ _id: -1 })
      .limit(500)
      .lean()
      .exec();
    const seenIds = seen.map((s) => new mongoose.Types.ObjectId(String(s.question_id)));

    let docs = await this.questions
      .aggregate([{ $match: { ...match, _id: { $nin: seenIds } } }, { $sample: { size: 1 } }])
      .exec();
    let repeated = false;
    if (docs.length === 0) {
      docs = await this.questions.aggregate([{ $match: match }, { $sample: { size: 1 } }]).exec();
      repeated = true;
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
    // though viewing is otherwise free.
    if (query.difficulty === 'hard') {
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
    };
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
