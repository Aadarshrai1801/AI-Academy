import {
  Body,
  Controller,
  Delete,
  Get,
  MethodNotAllowedException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../common/public.decorator.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { Role } from '../common/entitlements.service.js';
import { VideoService } from './video.service.js';

class RequestVideoDto {
  @IsOptional()
  @IsMongoId()
  canonicalId?: string;

  @IsOptional()
  @IsMongoId()
  queryId?: string;

  /** Groups the render into that topic's 3-5 video playlist. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  topicId?: string;
}

@Controller('ai/videos')
export class VideosController {
  constructor(private readonly videos: VideoService) {}

  /**
   * Request an explainer video (spec §2.6): canonical reuse is instant+free;
   * novel renders are Pro (quota + spend budget enforced). Returns 202 job.
   */
  @Post()
  request(@Req() req: { auth: { userId: string; role: Role } }, @Body() dto: RequestVideoDto) {
    return this.videos.request(req.auth.userId, req.auth.role, dto);
  }

  @Get()
  mine(@Req() req: { auth: { userId: string } }, @Query('limit') limit?: string) {
    return this.videos.mine(req.auth.userId, limit ? Number(limit) : 20);
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  stats() {
    return this.videos.monthStats();
  }

  /**
   * Topic playlist: ready videos grouped by sequence slot (3-5 per topic).
   * Canonical reuse means playlists are shared across users.
   */
  @Get('sequence/:topicId')
  sequence(@Param('topicId') topicId: string) {
    return this.videos.sequence(topicId);
  }

  /** End-of-playlist check for understanding (1-2 topic questions, free). */
  @Get('sequence/:topicId/check')
  check(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('topicId') topicId: string,
    @Query('count') count?: string,
  ) {
    return this.videos.checkQuestions(req.auth.userId, req.auth.role, topicId, count ? Number(count) : 2);
  }

  @Get(':id')
  status(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('id') id: string,
  ) {
    return this.videos.status(req.auth.userId, req.auth.role, id);
  }

  /** Signed mp4 stream for <video> playback (token auth, no session header). */
  @Get('file/:id')
  @Public()
  file(@Param('id') id: string, @Query('t') token: string | undefined, @Res() res: Response) {
    return this.videos.streamFile(id, token, res);
  }

  @Delete(':id')
  remove(): never {
    // Jobs are immutable history (audit + spend record) — no user delete.
    // Erasure requests are handled by the GDPR-friendly `DELETE /users/me`
    // workflow (admin-reviewed), not by ad-hoc per-row deletes.
    throw new MethodNotAllowedException(
      'Video jobs are immutable; request an erasure via support or DELETE /users/me',
    );
  }
}
