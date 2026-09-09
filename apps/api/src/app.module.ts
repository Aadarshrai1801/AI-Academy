import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CommonModule } from './common/common.module.js';
import { UsersModule } from './users/users.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';
import { StreaksModule } from './streaks/streaks.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { BillingModule } from './billing/billing.module.js';
import { LlmModule } from './llm/llm.module.js';
import { GenerationModule } from './generation/generation.module.js';
import { AdminModule } from './admin/admin.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { AiModule } from './ai/ai.module.js';
import { VideoModule } from './video/video.module.js';
import { CallsModule } from './calls/calls.module.js';
import { HealthController } from './health/health.controller.js';
import { QuotaController } from './quota/quota.controller.js';

/**
 * Phase 1 app wiring (spec §7).
 * Mongo is required for the practice loop — default to localhost so
 * `docker compose up -d mongo redis` just works with zero config.
 * Redis stays optional (quota/leaderboard degrade to allow/in-memory).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hoopr'),
    CommonModule,
    UsersModule,
    QuestionsModule,
    AttemptsModule,
    StreaksModule,
    LeaderboardModule,
    BillingModule,
    LlmModule,
    GenerationModule,
    AdminModule,
    GroupsModule,
    MessagesModule,
    RealtimeModule,
    AiModule,
    VideoModule,
    CallsModule,
  ],
  controllers: [AppController, HealthController, QuotaController],
  providers: [AppService],
})
export class AppModule {}
