import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { GenerationModule } from '../generation/generation.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { AuditEvent, AuditEventSchema } from './audit-event.schema.js';
import { AuditService } from './audit.service.js';
import { RetentionService } from './retention.service.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: AuditEvent.name, schema: AuditEventSchema },
    ]),
    GenerationModule,
    MessagesModule,
    GroupsModule,
    LeaderboardModule,
    BillingModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AuditService, RetentionService],
  exports: [AdminGuard],
})
export class AdminModule {}
