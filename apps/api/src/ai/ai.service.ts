import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AiQuery, AiQueryDocument } from './ai-query.schema.js';
import { Canonical, CanonicalDocument } from './canonical.schema.js';
import { LLM_PROVIDER } from '../llm/llm.provider.js';
import type { LlmProvider } from '../llm/llm.provider.js';
import { EntitlementsService, Role } from '../common/entitlements.service.js';
import { YoutubeService } from './youtube.service.js';
import { bestMatch, normalizeCanonical } from './canonical.js';

const simThreshold = () => {
  const v = Number(process.env.AI_SIMILARITY_THRESHOLD);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.92;
};
const recCount: Record<Role, number> = { free: 3, pro: 5, admin: 5 };

/**
 * AI Q&A (spec §2.6): topic gate → canonical cache (FREE, no quota) →
 * quota-checked generation → cached YouTube recs.
 * Cache hits never consume quota — the core cost-control lever.
 */
@Injectable()
export class AiService {
  constructor(
    @InjectModel(AiQuery.name) private readonly queries: Model<AiQueryDocument>,
    @InjectModel(Canonical.name) private readonly canonicals: Model<CanonicalDocument>,
    private readonly entitlements: EntitlementsService,
    private readonly youtube: YoutubeService,
    @Inject(LLM_PROVIDER) @Optional() private readonly llm?: LlmProvider,
  ) {}

  async ask(userId: string, role: Role, question: string) {
    const text = question.trim();
    if (text.length < 10 || text.length > 2000) {
      throw new HttpException(
        { statusCode: 400, error: 'question must be 10..2000 chars' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const norm = normalizeCanonical(text);

    // 1. Canonical cache (spec §2.6: serve instantly at zero marginal cost).
    let hit = await this.canonicals.findOne({ normalized: norm }).exec();
    if (!hit) {
      const cands = await this.canonicals
        .find({})
        .select('normalized')
        .sort({ updated_at: -1 })
        .limit(200)
        .lean()
        .exec();
      const m = bestMatch(text, cands, simThreshold());
      if (m) hit = await this.canonicals.findById(m.item._id).exec();
    }
    if (hit) {
      hit.times_reused += 1;
      await hit.save();
      const yt = await this.youtube.recommendations(text, recCount[role]);
      const q = await this.queries.create({
        user_id: userId,
        question_text: text,
        canonical_id: hit._id,
        text_answer: hit.text_answer,
        on_topic: true,
        cached: true,
        youtube: yt?.items ?? [],
      });
      return this.shape(q, hit.text_answer, true, yt?.items ?? []);
    }

    // 2. Miss → quota gate (429 with reset info for the upsell UI).
    const quota = await this.entitlements.check(userId, role, 'ai_text');
    if (!quota.allowed) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'AI answer quota exhausted',
          feature: 'ai_text',
          limit: quota.limit,
          resetAt: this.entitlements.resetAt('ai_text'),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!this.llm) throw new HttpException({ statusCode: 503, error: 'No LLM provider' }, HttpStatus.SERVICE_UNAVAILABLE);

    // 3. Generate (topic verdict included — off-topic never consumes quota).
    const { onTopic, answer } = await this.llm.answerQuestion(text);
    if (!onTopic || !answer.trim()) {
      await this.queries.create({ user_id: userId, question_text: text, text_answer: '', on_topic: false, cached: false, youtube: [] });
      throw new HttpException(
        { statusCode: 400, error: 'Off-topic: I answer AI/ML questions — try asking about models, training, or statistics.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.entitlements.consume(userId, role, 'ai_text');
    const yt = await this.youtube.recommendations(text, recCount[role]);

    const canon = await this.canonicals.create({
      canonical_text: text,
      normalized: norm,
      text_answer: answer,
      provider_model: this.llm.name,
      times_reused: 0,
      video_status: 'none', // Phase 5 attaches explainer videos here
    });
    const q = await this.queries.create({
      user_id: userId,
      question_text: text,
      canonical_id: canon._id,
      text_answer: answer,
      on_topic: true,
      cached: false,
      youtube: yt?.items ?? [],
    });
    const remaining = await this.entitlements.check(userId, role, 'ai_text');
    return { ...this.shape(q, answer, false, yt?.items ?? []), quota: { remaining: remaining.remaining, limit: remaining.limit } };
  }

  async history(userId: string, limit = 20) {
    const rows = await this.queries
      .find({ user_id: userId })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    return {
      items: rows.map((r) => ({
        id: String(r._id),
        question: r.question_text,
        cached: r.cached,
        onTopic: r.on_topic,
        youtubeCount: r.youtube?.length ?? 0,
        at: r.created_at,
      })),
    };
  }

  async get(userId: string, id: string) {
    const q = await this.queries.findOne({ _id: id, user_id: userId }).lean().exec();
    if (!q) throw new HttpException({ statusCode: 404, error: 'Not found' }, HttpStatus.NOT_FOUND);
    return this.shape(q, q.text_answer, q.cached, q.youtube ?? []);
  }

  async remove(userId: string, id: string) {
    await this.queries.deleteOne({ _id: id, user_id: userId }).exec();
    return { deleted: true };
  }

  async clearHistory(userId: string) {
    await this.queries.deleteMany({ user_id: userId }).exec();
    return { cleared: true };
  }

  /** Cache economics for ops (spec §5.4 spend awareness). */
  async stats() {
    const day = new Date().toISOString().slice(0, 10);
    const [today, cachedToday, canonicals] = await Promise.all([
      this.queries.countDocuments({ created_at: { $gte: new Date(`${day}T00:00:00Z`) } }).exec(),
      this.queries.countDocuments({ cached: true, created_at: { $gte: new Date(`${day}T00:00:00Z`) } }).exec(),
      this.canonicals.countDocuments().exec(),
    ]);
    return {
      day,
      queriesToday: today,
      cacheHitsToday: cachedToday,
      hitRate: today ? cachedToday / today : null,
      canonicals,
      provider: this.llm?.name ?? 'none',
      youtube: this.youtube.configured ? 'live' : 'disabled (set YOUTUBE_API_KEY)',
    };
  }

  private shape(q: AiQueryDocument | Record<string, unknown>, answer: string, cached: boolean, youtube: unknown[]) {
    const o = (q as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (q as Record<string, unknown>);
    return {
      id: String(o._id),
      question: o.question_text,
      answer, // rendered as plain text on the client (never raw HTML)
      cached,
      video_status: 'none', // Phase 5: queued/generating/ready
      youtube,
    };
  }
}
