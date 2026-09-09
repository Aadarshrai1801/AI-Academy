import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../common/entitlements.service.js';

/** Spec §1: content moderation / user management is admin-only. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role: Role | undefined = req.auth?.role;
    if (role !== 'admin') throw new ForbiddenException('Admin role required');
    return true;
  }
}
