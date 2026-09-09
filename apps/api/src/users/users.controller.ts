import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  me(@Req() req: { auth: { userId: string } }) {
    return this.users.me(req.auth.userId);
  }
}
