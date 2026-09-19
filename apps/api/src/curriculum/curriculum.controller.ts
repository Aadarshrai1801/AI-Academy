import { Controller, Get, Req } from '@nestjs/common';
import { Role } from '../common/entitlements.service.js';
import { CurriculumService } from './curriculum.service.js';

@Controller('topics')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  /**
   * Prerequisite DAG for the skill tree, annotated with the caller's
   * per-topic lock/progress status. Authenticated (global Clerk guard) but
   * free — it reads derived state only and consumes no quota.
   */
  @Get('graph')
  graph(@Req() req: { auth: { userId: string; role: Role } }) {
    return this.curriculum.graphFor(req.auth.userId);
  }
}
