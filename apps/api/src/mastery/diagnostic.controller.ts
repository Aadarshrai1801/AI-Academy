import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Role } from '../common/entitlements.service.js';
import { MasteryService } from './mastery.service.js';

class DiagnosticAnswerDto {
  @IsMongoId()
  questionId!: string;

  @IsString()
  @MaxLength(5000)
  answer!: string;
}

export class SubmitDiagnosticDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswerDto)
  answers!: DiagnosticAnswerDto[];
}

/**
 * Onboarding placement quiz: 8 questions across all topics and two difficulty
 * tiers, run once. Serving and grading are free (no quota), consistent with
 * the "serving spends nothing" rule for the practice loop.
 */
@Controller('mastery')
export class DiagnosticController {
  constructor(private readonly mastery: MasteryService) {}

  /** Start or resume the diagnostic (returns questions without answers). */
  @Get('diagnostic')
  get(@Req() req: { auth: { userId: string; role: Role } }) {
    return this.mastery.startOrResumeDiagnostic(req.auth.userId);
  }

  /** Grade + seed per-topic mastery. Once completed, re-submits get 409. */
  @Post('diagnostic')
  submit(
    @Req() req: { auth: { userId: string; role: Role } },
    @Body() dto: SubmitDiagnosticDto,
  ) {
    return this.mastery.submitDiagnostic(req.auth.userId, dto.answers);
  }
}
