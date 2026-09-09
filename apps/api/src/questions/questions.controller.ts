import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { QuotaGuard } from '../common/quota.guard.js';
import { RequireQuota } from '../common/quota.decorator.js';
import { Role } from '../common/entitlements.service.js';
import { QuestionsService } from './questions.service.js';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('topics')
  topics() {
    return this.questions.topics();
  }

  @Get('count')
  count() {
    return this.questions.count().then((total) => ({ total }));
  }

  @Get('next')
  @UseGuards(ClerkAuthGuard, QuotaGuard)
  @RequireQuota('practice_questions')
  next(
    @Req() req: { auth: { userId: string; role: Role } },
    @Query('difficulty') difficulty?: string,
    @Query('topic') topic?: string,
  ) {
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return { statusCode: 400, error: 'difficulty must be easy|medium|hard' };
    }
    return this.questions.next(req.auth.userId, req.auth.role, {
      difficulty: difficulty as 'easy' | 'medium' | 'hard' | undefined,
      topic: topic || undefined,
    });
  }

  /** Dev/admin bootstrap: POST /questions/seed (idempotent, 409 when already seeded). */
  @Post('seed')
  @UseGuards(ClerkAuthGuard)
  seed(@Req() req: { auth: { userId: string; role: Role } }) {
    return this.questions.seedIfEmpty(req.auth.role);
  }

  /** Specific question (group challenge deep-link) — quota-enforced like /next. */
  @Get(':id')
  @UseGuards(ClerkAuthGuard, QuotaGuard)
  @RequireQuota('practice_questions')
  byId(@Req() req: { auth: { userId: string; role: Role } }, @Param('id') id: string) {
    return this.questions.byId(req.auth.userId, req.auth.role, id);
  }
}
