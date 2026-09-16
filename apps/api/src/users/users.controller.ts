import { Body, Controller, Delete, Get, Patch, Query, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UsersService } from './users.service.js';

class UpdateProfileDto {
  /**
   * Public display name (leaderboard, cohorts, calls). User-controlled:
   * 3–30 chars, letters/numbers plus `_. -`, so it renders safely everywhere
   * a name is interpolated and can never smuggle markup or whitespace games.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message: 'username may only contain letters, numbers, underscore, dot and hyphen',
  })
  username!: string;

  /** Optional: fills the row for users created before email was ever stored. */
  @IsOptional()
  @IsEmail()
  email?: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: { auth: { userId: string } }) {
    return this.users.me(req.auth.userId);
  }

  /**
   * Set the caller's display name. Upserts so first-time sign-ins get a named
   * row immediately (user rows are otherwise only created nameless by the
   * attempt-submission upsert). 409 when the name is taken.
   */
  @Patch('me')
  updateMe(@Req() req: { auth: { userId: string } }, @Body() dto: UpdateProfileDto) {
    return this.users.setUsername(req.auth.userId, dto.username.trim(), dto.email?.trim());
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
