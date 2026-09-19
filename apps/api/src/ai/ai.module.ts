import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiQuery, AiQuerySchema } from './ai-query.schema.js';
import { Canonical, CanonicalSchema } from './canonical.schema.js';
import { MistakeExplanation, MistakeExplanationSchema } from './mistake-cache.schema.js';
import { YoutubeCache, YoutubeCacheSchema } from './youtube-cache.schema.js';
import { AdminModule } from '../admin/admin.module.js';
import { YoutubeService } from './youtube.service.js';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiQuery.name, schema: AiQuerySchema },
      { name: Canonical.name, schema: CanonicalSchema },
      { name: MistakeExplanation.name, schema: MistakeExplanationSchema },
      { name: YoutubeCache.name, schema: YoutubeCacheSchema },
    ]),
    AdminModule, // AdminGuard for /ai/stats
  ],
  controllers: [AiController],
  providers: [AiService, YoutubeService],
})
export class AiModule {}
