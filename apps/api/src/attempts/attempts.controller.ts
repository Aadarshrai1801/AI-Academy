import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsMongoId, IsString, Max, MaxLength, Min } from 'class-validator';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { AttemptsService } from './attempts.service.js';

class SubmitAttemptDto {
  @IsMongoId()
  questionId!: string;

  @IsString()
  @MaxLength(5000)
  answer!: string;

  @IsInt()
  @Min(0)
  @Max(3600000)
  timeTakenMs!: number;
}

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post()
  @UseGuards(ClerkAuthGuard)
  submit(@Req() req: { auth: { userId: string } }, @Body() dto: SubmitAttemptDto) {
    return this.attempts.submit(req.auth.userId, dto);
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  history(
    @Req() req: { auth: { userId: string } },
    @Query('limit') limit?: string,
    @Query('day') day?: string,
  ) {
    return this.attempts.history(req.auth.userId, Number(limit) || 20, day).then((items) => ({ items }));
  }

  @Delete('me/all')
  @UseGuards(ClerkAuthGuard)
  clearHistory(@Req() req: { auth: { userId: string } }) {
    return this.attempts.clearHistory(req.auth.userId);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  remove(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.attempts.remove(req.auth.userId, id);
  }

  @Get('me/summary')
  @UseGuards(ClerkAuthGuard)
  summary(@Req() req: { auth: { userId: string } }) {
    return this.attempts.summary(req.auth.userId);
  }

  @Get('me/analytics')
  @UseGuards(ClerkAuthGuard)
  analytics(
    @Req() req: { auth: { userId: string; role: 'free' | 'pro' | 'admin' } },
    @Query('days') days?: string,
  ) {
    return this.attempts.analytics(req.auth.userId, req.auth.role ?? 'free', Number(days) || 30);
  }
}
