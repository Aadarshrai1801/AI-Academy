import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QUOTA_FEATURE_KEY } from './quota.decorator.js';
import { EntitlementsService, Role } from './entitlements.service.js';

/**
 * Quota enforcement (spec §2.7, §5.2). Pair with @RequireQuota('practice_questions').
 * Expects ClerkAuthGuard (or dev bypass) to have run first and set request.auth.
 * On exhaustion throws 429 with limit/reset info for the web paywall modal.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(QUOTA_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.auth?.userId;
    const role: Role = req.auth?.role ?? 'free';
    if (!userId) return false;

    const state = await this.entitlements.check(userId, role, feature);
    if (!state.allowed) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Quota exhausted',
          feature,
          limit: state.limit,
          resetAt: this.entitlements.resetAt(feature),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
