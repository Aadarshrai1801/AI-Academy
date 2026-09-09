import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClerkAuthGuard } from '../common/clerk-auth.guard.js';
import { Role } from '../common/entitlements.service.js';
import { MessagesService } from './messages.service.js';

class SendDto {
  @IsOptional()
  @IsIn(['text', 'question_share'])
  type?: 'text' | 'question_share';

  @IsString()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsMongoId()
  questionId?: string;
}

class ReactDto {
  @IsString()
  @MaxLength(12)
  emoji!: string;
}

class EditDto {
  @IsString()
  @MaxLength(4000)
  content!: string;
}

class ReportDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

@Controller()
@UseGuards(ClerkAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('groups/:id/messages')
  send(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('id') id: string,
    @Body() dto: SendDto,
  ) {
    return this.messages.send(req.auth.userId, req.auth.role, id, dto);
  }

  @Get('groups/:id/messages')
  history(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.history(req.auth.userId, req.auth.role, id, {
      before,
      since,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('groups/:gid/messages/:id/read')
  markRead(@Req() req: { auth: { userId: string } }, @Param('gid') gid: string, @Param('id') id: string) {
    return this.messages.markRead(req.auth.userId, gid, id);
  }

  @Post('groups/:gid/messages/:id/react')
  react(
    @Req() req: { auth: { userId: string } },
    @Param('gid') gid: string,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.messages.react(req.auth.userId, gid, id, dto.emoji);
  }

  @Patch('groups/:gid/messages/:id')
  edit(
    @Req() req: { auth: { userId: string } },
    @Param('gid') gid: string,
    @Param('id') id: string,
    @Body() dto: EditDto,
  ) {
    return this.messages.edit(req.auth.userId, gid, id, dto.content);
  }

  @Delete('groups/:gid/messages/:id')
  remove(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('gid') gid: string,
    @Param('id') id: string,
  ) {
    return this.messages.remove(req.auth.userId, req.auth.role, gid, id);
  }

  @Post('groups/:gid/messages/:id/report')
  report(
    @Req() req: { auth: { userId: string } },
    @Param('gid') gid: string,
    @Param('id') id: string,
    @Body() dto: ReportDto,
  ) {
    return this.messages.report(req.auth.userId, gid, id, dto.reason);
  }
}
