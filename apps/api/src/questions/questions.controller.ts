import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard.js';
import { Public } from '../common/public.decorator.js';
import { Role } from '../common/entitlements.service.js';
import { QuestionsService } from './questions.service.js';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  /** Catalog metadata — public so the landing page can render topics. */
  @Get('topics')
  @Public()
  topics() {
    return this.questions.topics();
  }

  /** Public bank size (no per-user data). */
  @Get('count')
  @Public()
  count() {
    return this.questions.count().then((total) => ({ total }));
  }

  @Get('next')
  next(
    @Req() req: { auth: { userId: string; role: Role } },
    @Query('difficulty') difficulty?: string,
    @Query('topic') topic?: string,
  ) {
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new BadRequestException('difficulty must be easy|medium|hard');
    }
    return this.questions.next(req.auth.userId, req.auth.role, {
      difficulty: difficulty as 'easy' | 'medium' | 'hard' | undefined,
      topic: topic || undefined,
    });
  }

  /**
   * Admin-only bank bootstrap/top-up: POST /questions/seed.
   *
   * AdminGuard covers BOTH paths — the empty-bank bootstrap and the non-empty
   * top-up — so a signed-in learner can never trigger writes to the bank.
   * (The `npm run seed` CLI writes Mongo directly and never calls this route.)
   */
  @Post('seed')
  @UseGuards(AdminGuard)
  seed(@Req() req: { auth: { userId: string; role: Role } }) {
    return this.questions.seedIfEmpty(req.auth.role);
  }

  /** Specific question (group challenge deep-link). */
  @Get(':id')
  byId(@Req() req: { auth: { userId: string; role: Role } }, @Param('id') id: string) {
    return this.questions.byId(req.auth.userId, req.auth.role, id);
  }
}
