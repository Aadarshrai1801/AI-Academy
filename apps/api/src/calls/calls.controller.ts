import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { Role } from '../common/entitlements.service.js';
import { CallsService } from './calls.service.js';

class StartDto {
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsString()
  inviteeId?: string;
}

class ReportDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

@Controller('calls')
@UseGuards(ClerkAuthGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  /** Start a 1:1 ({ inviteeId }) or group ({ groupId }, Pro) call. */
  @Post('start')
  start(@Req() req: { auth: { userId: string; role: Role } }, @Body() dto: StartDto) {
    return this.calls.start(req.auth.userId, req.auth.role, dto);
  }

  @Get()
  mine(
    @Req() req: { auth: { userId: string } },
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.calls.mine(req.auth.userId, groupId, limit ? Number(limit) : 20);
  }

  @Post(':id/join')
  join(@Req() req: { auth: { userId: string; role: Role } }, @Param('id') id: string) {
    return this.calls.join(req.auth.userId, req.auth.role, id);
  }

  @Post(':id/token')
  token(@Req() req: { auth: { userId: string; role: Role } }, @Param('id') id: string) {
    return this.calls.token(req.auth.userId, req.auth.role, id);
  }

  @Post(':id/leave')
  leave(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.calls.leave(req.auth.userId, id);
  }

  @Post(':id/end')
  end(@Req() req: { auth: { userId: string; role: Role } }, @Param('id') id: string) {
    return this.calls.end(req.auth.userId, req.auth.role, id);
  }

  @Post(':id/screen-share')
  screenShare(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.calls.screenShare(req.auth.userId, id);
  }

  @Post(':id/report')
  report(@Req() req: { auth: { userId: string } }, @Param('id') id: string, @Body() dto: ReportDto) {
    return this.calls.report(req.auth.userId, id, dto.reason);
  }

  @Delete('history/all')
  clearHistory(@Req() req: { auth: { userId: string } }) {
    return this.calls.clearHistory(req.auth.userId);
  }

  @Delete(':id')
  remove(@Req() req: { auth: { userId: string } }, @Param('id') id: string) {
    return this.calls.remove(req.auth.userId, id);
  }
}
