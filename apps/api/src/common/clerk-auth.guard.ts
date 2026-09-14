import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../users/users.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { devAuthBypassEnabled, isProduction } from '../config.js';

/**
 * Clerk auth guard (spec §5.3: RBAC enforced server-side, never trust client role).
 * - Registered globally (APP_GUARD): routes are deny-by-default and opt out
 *   explicitly with `@Public()`.
 * - Expects `Authorization: Bearer <Clerk session token>`.
 * - Local dev without CLERK_SECRET_KEY: passes through with a dev stub user.
 *   This bypass is impossible in production (boot fails when the key is unset).
 * - Attaches `request.auth = { userId, role }` with role resolved from our DB
 *   (source: Stripe webhook sync). Falls back to 'free' when DB is unreachable.
 */
let warnedDevBypass = false;

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly users?: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Signed-token routes (e.g. <video> playback) opt out via @Public().
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      // Belt-and-braces: assertBootConfig() already refuses to boot production
      // without CLERK_SECRET_KEY, but a runtime check keeps this guard safe if
      // the guard is reused outside the standard bootstrap.
      if (isProduction()) {
        throw new HttpException(
          { statusCode: 503, error: 'Authentication is not configured' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (!devAuthBypassEnabled()) {
        throw new UnauthorizedException('Authentication is not configured');
      }
      if (!warnedDevBypass) {
        warnedDevBypass = true;
        // eslint-disable-next-line no-console
        console.warn(
          '[auth] CLERK_SECRET_KEY unset — dev bypass active. Do not deploy like this.',
        );
      }
      req.auth = { userId: 'dev-user', role: await this.resolveRole('dev-user') };
      return true;
    }

    const header: string = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await verifyToken(token, { secretKey });
      req.auth = { userId: payload.sub, role: await this.resolveRole(payload.sub) };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid session token');
    }
  }

  private async resolveRole(userId: string): Promise<'free' | 'pro' | 'admin'> {
    try {
      const role = await this.users?.roleOf(userId);
      return role ?? 'free';
    } catch {
      return 'free';
    }
  }
}
