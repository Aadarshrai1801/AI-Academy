import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoJob, VideoJobSchema } from './video-job.schema.js';
import { Canonical, CanonicalSchema } from '../ai/canonical.schema.js';
import { AiQuery, AiQuerySchema } from '../ai/ai-query.schema.js';
import { AdminModule } from '../admin/admin.module.js';
import { VideoService } from './video.service.js';
import { VideosController } from './videos.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VideoJob.name, schema: VideoJobSchema },
      { name: Canonical.name, schema: CanonicalSchema },
      { name: AiQuery.name, schema: AiQuerySchema },
    ]),
    AdminModule, // AdminGuard for /ai/videos/stats
  ],
  controllers: [VideosController],
  providers: [VideoService],
})
export class VideoModule {}
