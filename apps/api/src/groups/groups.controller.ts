import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { Role } from '../common/entitlements.service.js';
import { GroupsService } from './groups.service.js';

class CreateGroupDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(['invite_only', 'public'])
  privacy?: 'invite_only' | 'public';
}

class JoinDto {
  @IsString()
  code!: string;
}

@Controller('groups')
@UseGuards(ClerkAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  create(@Req() req: { auth: { userId: string; role: Role } }, @Body() dto: CreateGroupDto) {
    return this.groups.create(req.auth.userId, req.auth.role, dto);
  }

  @Get()
  mine(@Req() req: { auth: { userId: string } }) {
    return this.groups.mine(req.auth.userId);
  }

  @Post('join')
  join(@Req() req: { auth: { userId: string } }, @Body() dto: JoinDto) {
    return this.groups.join(req.auth.userId, dto.code.trim());
  }

  @Get(':id')
  get(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.groups.get(req.auth.userId, id);
  }

  @Delete(':id')
  remove(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.groups.remove(req.auth.userId, id);
  }

  @Post(':id/leave')
  leave(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.groups.leave(req.auth.userId, id);
  }

  @Post(':id/kick')
  kick(@Req() req: { auth: { userId: string } }, @Param('id') id: string, @Body() dto: { userId: string }) {
    return this.groups.kick(req.auth.userId, id, dto.userId);
  }

  @Post(':id/invite/rotate')
  rotate(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.groups.rotateInvite(req.auth.userId, id);
  }

  @Get(':id/leaderboard')
  board(@Req() req: { auth: { userId: string } }, @Param('id') id: string, @Query('date') date?: string) {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    return this.groups.memberBoard(req.auth.userId, id, day);
  }
}
