import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../common/entitlements.service.js';
import { MessagesService } from './messages.service.js';

class SendDto {
  @IsOptional()
  @IsIn(['text', 'question_share', 'study_prompt'])
  type?: 'text' | 'question_share' | 'study_prompt';

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
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // ── Direct Messages (1:1 personalized chat) ───────────────────────────────

  @Get('messages/conversations')
  conversations(@Req() req: { auth: { userId: string } }) {
    return this.messages.listConversations(req.auth.userId);
  }

  @Get('messages/peers')
  peers(@Req() req: { auth: { userId: string } }) {
    return this.messages.getPeers(req.auth.userId);
  }

  @Get('messages/direct/:partnerId')
  directHistory(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('partnerId') partnerId: string,
    @Query('before') before?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.directHistory(req.auth.userId, req.auth.role, partnerId, {
      before,
      since,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('messages/direct/:partnerId')
  sendDirect(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('partnerId') partnerId: string,
    @Body() dto: SendDto,
  ) {
    return this.messages.sendDirect(req.auth.userId, req.auth.role, partnerId, dto);
  }

  @Post('messages/direct/:partnerId/read')
  markDirectConvoRead(@Req() req: { auth: { userId: string } }, @Param('partnerId') partnerId: string) {
    return this.messages.markDirectRead(req.auth.userId, partnerId);
  }

  @Post('messages/direct/:partnerId/:id/read')
  markDirectMessageRead(
    @Req() req: { auth: { userId: string } },
    @Param('partnerId') partnerId: string,
    @Param('id') id: string,
  ) {
    return this.messages.markDirectRead(req.auth.userId, partnerId, id);
  }

  @Post('messages/direct/:partnerId/:id/react')
  reactDirect(
    @Req() req: { auth: { userId: string } },
    @Param('partnerId') partnerId: string,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.messages.reactDirect(req.auth.userId, partnerId, id, dto.emoji);
  }

  @Patch('messages/direct/:partnerId/:id')
  editDirect(
    @Req() req: { auth: { userId: string } },
    @Param('partnerId') partnerId: string,
    @Param('id') id: string,
    @Body() dto: EditDto,
  ) {
    return this.messages.editDirect(req.auth.userId, partnerId, id, dto.content);
  }

  @Delete('messages/direct/:partnerId/:id')
  removeDirect(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('partnerId') partnerId: string,
    @Param('id') id: string,
  ) {
    return this.messages.removeDirect(req.auth.userId, req.auth.role, partnerId, id);
  }

  @Post('messages/direct/:partnerId/:id/report')
  reportDirect(
    @Req() req: { auth: { userId: string } },
    @Param('partnerId') partnerId: string,
    @Param('id') id: string,
    @Body() dto: ReportDto,
  ) {
    return this.messages.reportDirect(req.auth.userId, partnerId, id, dto.reason);
  }

  // ── Group Chat ────────────────────────────────────────────────────────────

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
