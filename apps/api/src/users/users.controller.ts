import { Controller, Delete, Get, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: { auth: { userId: string } }) {
    return this.users.me(req.auth.userId);
  }

  /** GDPR data portability: everything we store about the caller, as JSON. */
  @Get('me/export')
  export(@Req() req: { auth: { userId: string } }) {
    return this.users.exportData(req.auth.userId);
  }

  /**
   * GDPR erasure (app-side). Requires an explicit confirmation flag so an
   * accidental call can't wipe an account: `DELETE /users/me?confirm=DELETE`.
   * Clerk-side deletion happens via the Clerk dashboard/webhook (see README).
   */
  @Delete('me')
  erase(
    @Req() req: { auth: { userId: string } },
    @Query('confirm') confirm?: string,
  ) {
    return this.users.erase(req.auth.userId, confirm === 'DELETE');
  }
}
