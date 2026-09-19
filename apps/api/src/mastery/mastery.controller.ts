import { Controller, Get, Req } from '@nestjs/common';
import { Role } from '../common/entitlements.service.js';
import { MasteryService } from './mastery.service.js';

@Controller('users/me')
export class MasteryController {
  constructor(private readonly mastery: MasteryService) {}

  /**
   * Per-topic mastery for the learner dashboard (Phase 9). Authenticated and
   * free — derived from the caller's own attempts, consumes no quota.
   * Distinct from the admin-only analytics endpoints.
   */
  @Get('mastery')
  me(@Req() req: { auth: { userId: string; role: Role } }) {
    return this.mastery.summary(req.auth.userId);
  }
}
