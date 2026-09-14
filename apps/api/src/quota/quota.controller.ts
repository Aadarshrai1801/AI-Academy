import { Controller, Get, Query, Req } from '@nestjs/common';
import { EntitlementsService, Role } from '../common/entitlements.service.js';

/** Phase 0 demo endpoint: GET /quota/check?feature=practice_questions */
@Controller('quota')
export class QuotaController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('check')
  async check(
    @Req() req: { auth: { userId: string; role?: Role } },
    @Query('feature') feature = 'practice_questions',
  ) {
    const role = req.auth.role ?? 'free';
    return {
      userId: req.auth.userId,
      role,
      feature,
      ...(await this.entitlements.check(req.auth.userId, role, feature)),
    };
  }
}
