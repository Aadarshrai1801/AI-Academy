import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { GenerationService } from '../generation/generation.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { BillingService } from '../billing/billing.service.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';

class EnsureDto {
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: 'easy' | 'medium' | 'hard';
}

class ReviewDto {
  @IsIn(['approved', 'flagged']) status!: 'approved' | 'flagged';
}

/**
 * Admin surface (spec §1, §2.1): generation backfill control + human-in-the-loop
 * review queue for flagged/low-confidence generations.
 */
@Controller('admin')
@UseGuards(ClerkAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly generation: GenerationService,
    private readonly chat: MessagesService,
    private readonly board: LeaderboardService,
    private readonly billing: BillingService,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
  ) {}

  @Get('generation/status')
  genStatus() {
    return this.generation.status();
  }

  @Post('generation/ensure')
  ensure(@Body() dto: EnsureDto) {
    return this.generation.ensureBuffer(dto.topic, dto.difficulty);
  }

  @Post('generation/clean-failed')
  cleanFailed() {
    return this.generation.cleanFailed();
  }

  @Post('generation/drain-waiting')
  drainWaiting() {
    return this.generation.drainWaiting();
  }

  @Post('generation/trim')
  trim() {
    return this.generation.trimToTarget();
  }

  @Get('review')
  async review(
    @Query('status') status = 'pending_review',
    @Query('limit') limit?: string,
  ) {
    if (!['pending_review', 'flagged'].includes(status)) {
      return { statusCode: 400, error: 'status must be pending_review|flagged' };
    }
    const items = await this.questions
      .find({ quality_status: status })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(Number(limit) || 25, 1), 100))
      .lean()
      .exec();
    return {
      items: items.map((q) => ({
        id: String(q._id),
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        source: q.source,
        generation_model: q.generation_model,
        quality_score: q.quality_score,
        flag_reason: q.flag_reason,
      })),
    };
  }

  @Patch('review/:id')
  async decide(@Param('id') id: string, @Body() dto: ReviewDto) {
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, error: 'Invalid id' };
    const q = await this.questions
      .findByIdAndUpdate(
        id,
        { quality_status: dto.status, flag_reason: dto.status === 'flagged' ? 'rejected by reviewer' : undefined },
        { new: true },
      )
      .exec();
    if (!q) return { statusCode: 404, error: 'Question not found' };
    return { id: String(q._id), quality_status: q.quality_status };
  }

  @Get('users/count-by-role')
  async roles() {
    // Cheap support overview (spec §1: admin support view).
    const User = this.questions.db.model('User');
    const rows = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).exec();
    return { roles: rows };
  }

  @Post('users/:clerkId/role')
  async setRole(@Param('clerkId') clerkId: string, @Body() dto: { role: 'free' | 'pro' | 'admin' }) {
    if (!['free', 'pro', 'admin'].includes(dto.role)) {
      return { statusCode: 400, error: 'role must be free|pro|admin' };
    }
    const User = this.questions.db.model('User');
    await User.findOneAndUpdate({ clerkId }, { role: dto.role }).exec();
    return { clerkId, role: dto.role };
  }

  @Get('reports')
  async reports(@Query('limit') limit?: string) {
    return this.chat.flaggedForAdmin(limit ? Number(limit) : 50);
  }
  @Get('call-reports')
  async callReports(@Query('limit') limit?: string) {
    const Call = this.questions.db.model('Call');
    const rows = await Call.find({ flagged: true })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 100))
      .lean()
      .exec();
    return { items: rows };
  }

  /** Rebuild a leaderboard snapshot for a date (default yesterday). */
  @Post('leaderboard/snapshot')
  snapshot(@Body() dto: { date?: string }) {
    const day =
      dto.date && /^\d{4}-\d{2}-\d{2}$/.test(dto.date)
        ? dto.date
        : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return this.board.snapshot(day);
  }

  /** Platform analytics (spec §1 admin view): engagement, content, spend, revenue. */
  @Get('analytics')
  async analytics(@Query('days') days?: string) {
    const n = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = new Date(Date.now() - n * 86400000);
    const db = this.questions.db;
    const Attempt = db.model('Attempt');
    const AiQuery = db.model('AiQuery');
    const VideoJob = db.model('VideoJob');
    const User = db.model('User');
    const Call = db.model('Call');

    const [perDay, totals, revenue] = await Promise.all([
      Attempt.aggregate([
        { $match: { created_at: { $gte: since } } },
        {
          $group: {
            _id: '$day_bucket',
            dau: { $addToSet: '$user_id' },
            attempts: { $sum: 1 },
            score: { $sum: '$points_awarded' },
          },
        },
        { $project: { day: '$_id', dau: { $size: '$dau' }, attempts: 1, score: 1, _id: 0 } },
        { $sort: { day: 1 } },
      ]).exec(),
      Promise.all([
        Attempt.countDocuments({ created_at: { $gte: since } }).exec(),
        User.countDocuments({ created_at: { $gte: since } }).exec(),
        AiQuery.countDocuments({ created_at: { $gte: since } }).exec(),
        AiQuery.countDocuments({ cached: true, created_at: { $gte: since } }).exec(),
        VideoJob.countDocuments({ status: 'ready', created_at: { $gte: since } }).exec(),
        Call.aggregate([
          { $match: { ended_at: { $gte: since } } },
          { $group: { _id: null, seconds: { $sum: '$duration_sec' } } },
        ]).exec(),
      ]),
      this.billing.revenueSnapshot(),
    ]);
    const [attempts, newUsers, aiQueries, aiHits, videosReady, callAgg] = totals as [
      number, number, number, number, number, Array<{ seconds: number }>,
    ];
    return {
      days: n,
      perDay,
      totals: {
        attempts,
        newUsers,
        aiQueries,
        aiHitRate: aiQueries ? aiHits / aiQueries : null,
        videosReady,
        callMinutes: Math.ceil((callAgg[0]?.seconds ?? 0) / 60),
      },
      revenue,
    };
  }

  @Get('stats')
  async stats(
    @Query('limit') limit?: string,
  ): Promise<{ items: Array<{ questionId: string; timesServed: number; timesCorrect: number; accuracy: number | null }> }> {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const rows = await this.questions
      .find({ times_served: { $gt: 0 } })
      .sort({ times_served: -1 })
      .limit(n)
      .select('times_served times_correct')
      .lean()
      .exec();
    return {
      items: rows.map((q) => ({
        questionId: String(q._id),
        timesServed: q.times_served,
        timesCorrect: q.times_correct,
        accuracy: q.times_served ? q.times_correct / q.times_served : null,
      })),
    };
  }
}
