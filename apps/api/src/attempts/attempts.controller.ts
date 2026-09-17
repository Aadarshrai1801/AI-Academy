import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsMongoId, IsString, Max, MaxLength, Min } from 'class-validator';
import { Role } from '../common/entitlements.service.js';
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
  submit(@Req() req: { auth: { userId: string; role: Role } }, @Body() dto: SubmitAttemptDto) {
    return this.attempts.submit(req.auth.userId, req.auth.role ?? 'free', dto);
  }

  @Get('me')
  history(
    @Req() req: { auth: { userId: string } },
    @Query('limit') limit?: string,
    @Query('day') day?: string,
  ) {
    return this.attempts.history(req.auth.userId, Number(limit) || 20, day).then((items) => ({ items }));
  }

  @Delete('me/all')
  clearHistory(@Req() req: { auth: { userId: string } }) {
    return this.attempts.clearHistory(req.auth.userId);
  }

  @Delete(':id')
  remove(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.attempts.remove(req.auth.userId, id);
  }

  @Get('me/summary')
  summary(@Req() req: { auth: { userId: string } }) {
    return this.attempts.summary(req.auth.userId);
  }

  @Get('me/analytics')
  analytics(
    @Req() req: { auth: { userId: string; role: Role } },
    @Query('days') days?: string,
  ) {
    return this.attempts.analytics(req.auth.userId, req.auth.role ?? 'free', Number(days) || 30);
  }
}
