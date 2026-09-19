import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminGuard } from '../admin/admin.guard.js';
import { Role } from '../common/entitlements.service.js';
import { AiService } from './ai.service.js';

class AskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  question!: string;

  /** "Explain my mistake" context (all optional; supplied together). */
  @IsOptional()
  @IsMongoId()
  questionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userAnswer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctAnswer?: string;

  /** Author-provided bank explanation, used as grounding when present. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Free-form Q&A (cache-first, quota-checked generation), or the
   * "explain my mistake" flow when `userAnswer` + `correctAnswer` are present.
   */
  @Post('ask')
  ask(@Req() req: { auth: { userId: string; role: Role } }, @Body() dto: AskDto) {
    if (dto.userAnswer?.trim() && dto.correctAnswer?.trim()) {
      return this.ai.explainMistake(req.auth.userId, req.auth.role, {
        question: dto.question,
        userAnswer: dto.userAnswer,
        correctAnswer: dto.correctAnswer,
        explanation: dto.explanation,
        questionId: dto.questionId,
      });
    }
    return this.ai.ask(req.auth.userId, req.auth.role, dto.question);
  }

  @Get('history')
  history(@Req() req: { auth: { userId: string } }, @Query('limit') limit?: string) {
    return this.ai.history(req.auth.userId, limit ? Number(limit) : 20);
  }

  @Delete('history')
  clearHistory(@Req() req: { auth: { userId: string } }) {
    return this.ai.clearHistory(req.auth.userId);
  }

  @Get('queries/:id')
  get(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.ai.get(req.auth.userId, id);
  }

  @Delete('queries/:id')
  remove(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.ai.remove(req.auth.userId, id);
  }

  /** Cache economics for ops (spec §5.4). Admin-only. */
  @Get('stats')
  @UseGuards(AdminGuard)
  stats() {
    return this.ai.stats();
  }
}
