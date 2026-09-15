import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import { AdminGuard } from './admin.guard.js';
import { AuditService } from './audit.service.js';
import { RetentionService } from './retention.service.js';
import { GenerationService } from '../generation/generation.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { BillingService } from '../billing/billing.service.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';

class EnsureDto {
  @IsOptional() @IsString() @MaxLength(64) topic?: string;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: 'easy' | 'medium' | 'hard';
}

class ReviewDto {
  @IsIn(['approved', 'flagged']) status!: 'approved' | 'flagged';
}

class RoleDto {
  @IsIn(['free', 'pro', 'admin']) role!: 'free' | 'pro' | 'admin';
}

class SnapshotDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

class PurgeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) olderThanDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) limit?: number;
}

type AdminReq = { auth: { userId: string }; ip?: string; socket?: { remoteAddress?: string } };

const actorIp = (req: AdminReq) => req.ip ?? req.socket?.remoteAddress;

/**
 * Admin surface (spec §1, §2.1): generation backfill control + human-in-the-loop
 * review queue for flagged/low-confidence generations.
 *
 * Every mutating action is recorded in the append-only audit trail with the
 * acting admin, target, and request context. Auth is deny-by-default (global
 * ClerkAuthGuard) + AdminGuard role check.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly generation: GenerationService,
    private readonly chat: MessagesService,
    private readonly board: LeaderboardService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly retention: RetentionService,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
  ) {}

  @Get('generation/status')
  genStatus() {
    return this.generation.status();
  }

  @Post('generation/ensure')
  async ensure(@Req() req: AdminReq, @Body() dto: EnsureDto) {
    const result = await this.generation.ensureBuffer(dto.topic, dto.difficulty);
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.generation.ensure',
      target: [dto.topic, dto.difficulty].filter(Boolean).join('/') || 'all',
      meta: { enqueued: result.enqueued.length, target: result.target },
      ip: actorIp(req),
    });
    return result;
  }

  @Post('generation/clean-failed')
  async cleanFailed(@Req() req: AdminReq) {
    const result = await this.generation.cleanFailed();
    await this.audit.record({ actor: req.auth.userId, action: 'admin.generation.clean_failed', ip: actorIp(req) });
    return result;
  }

  @Post('generation/drain-waiting')
  async drainWaiting(@Req() req: AdminReq) {
    const result = await this.generation.drainWaiting();
    await this.audit.record({ actor: req.auth.userId, action: 'admin.generation.drain_waiting', ip: actorIp(req) });
    return result;
  }

  @Post('generation/trim')
  async trim(@Req() req: AdminReq) {
    const result = await this.generation.trimToTarget();
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.generation.trim',
      meta: { trimmed: result.trimmed.length },
      ip: actorIp(req),
    });
    return result;
  }

  @Get('review')
  async review(
    @Query('status') status = 'pending_review',
    @Query('limit') limit?: string,
  ) {
    if (!['pending_review', 'flagged'].includes(status)) {
      throw new BadRequestException('status must be pending_review|flagged');
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
  async decide(@Req() req: AdminReq, @Param('id') id: string, @Body() dto: ReviewDto) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id');
    const q = await this.questions
      .findByIdAndUpdate(
        id,
        { quality_status: dto.status, flag_reason: dto.status === 'flagged' ? 'rejected by reviewer' : undefined },
        { new: true },
      )
      .exec();
    if (!q) throw new NotFoundException('Question not found');
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.review.decided',
      target: id,
      meta: { status: dto.status, topic: q.topic, difficulty: q.difficulty },
      ip: actorIp(req),
    });
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
  async setRole(@Req() req: AdminReq, @Param('clerkId') clerkId: string, @Body() dto: RoleDto) {
    if (!clerkId?.trim()) throw new BadRequestException('clerkId is required');
    const User = this.questions.db.model('User');
    const updated = await User.findOneAndUpdate({ clerkId }, { role: dto.role }, { new: true }).exec();
    if (!updated) throw new NotFoundException(`User not found: ${clerkId}`);
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.user.role_changed',
      target: clerkId,
      meta: { role: dto.role },
      ip: actorIp(req),
    });
    return { clerkId, role: dto.role };
  }

  /** Recent audit entries (support/accountability view). */
  @Get('audit')
  async auditLog(@Query('limit') limit?: string) {
    return { items: await this.audit.recent(limit ? Number(limit) : 100) };
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
  async snapshot(@Req() req: AdminReq, @Body() dto: SnapshotDto) {
    const day = dto.date ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const result = await this.board.snapshot(day);
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.leaderboard.snapshot',
      target: day,
      ip: actorIp(req),
    });
    return result;
  }

  /** Repair subscription/role rows that desynced from Stripe webhooks. */
  @Post('billing/reconcile')
  async reconcileBilling(@Req() req: AdminReq) {
    const result = await this.billing.reconcile();
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.billing.reconcile',
      meta: result,
      ip: actorIp(req),
    });
    return result;
  }

  /** Dry-run counts for the retention purges (no writes). */
  @Get('retention/status')
  retentionStatus() {
    return this.retention.status();
  }

  /** Hard-delete soft-deleted messages past the grace window (audited). */
  @Post('retention/purge-messages')
  async purgeMessages(@Req() req: AdminReq, @Body() dto: PurgeDto) {
    const result = await this.retention.purgeDeletedMessages(dto.olderThanDays, dto.limit);
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.retention.purge_messages',
      meta: { ...result, olderThanDays: dto.olderThanDays ?? null, limit: dto.limit ?? null },
      ip: actorIp(req),
    });
    return result;
  }

  /** Hard-delete soft-deleted groups past the grace window + their messages (audited). */
  @Post('retention/purge-groups')
  async purgeGroups(@Req() req: AdminReq, @Body() dto: PurgeDto) {
    const result = await this.retention.purgeDeletedGroups(dto.olderThanDays, dto.limit);
    await this.audit.record({
      actor: req.auth.userId,
      action: 'admin.retention.purge_groups',
      meta: { ...result, olderThanDays: dto.olderThanDays ?? null, limit: dto.limit ?? null },
      ip: actorIp(req),
    });
    return result;
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
