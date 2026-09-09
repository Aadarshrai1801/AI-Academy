import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { UsersService } from '../users/users.service.js';

/**
 * Clerk auth guard (spec §5.3: RBAC enforced server-side, never trust client role).
 * - Expects `Authorization: Bearer <Clerk session token>`.
 * - If CLERK_SECRET_KEY is unset (local dev), passes through with a dev stub user.
 * - Attaches `request.auth = { userId, role }` with role resolved from our DB
 *   (source: Stripe webhook sync). Falls back to 'free' when DB is unreachable.
 */
let warnedDevBypass = false;

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(@Optional() private readonly users?: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
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
