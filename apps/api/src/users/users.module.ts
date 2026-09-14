import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema.js';
import { Subscription, SubscriptionSchema } from '../billing/subscription.schema.js';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema.js';
import { Streak, StreakSchema } from '../streaks/streak.schema.js';
import { AiQuery, AiQuerySchema } from '../ai/ai-query.schema.js';
import { VideoJob, VideoJobSchema } from '../video/video-job.schema.js';
import { Call, CallSchema } from '../calls/call.schema.js';
import { Group, GroupSchema } from '../groups/group.schema.js';
import { Message, MessageSchema } from '../messages/message.schema.js';
import {
  LeaderboardSnapshot,
  LeaderboardSnapshotSchema,
} from '../leaderboard/leaderboard-snapshot.schema.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

/**
 * User profile + GDPR self-service. The schemas below are registered so the
 * erasure/export flows can cascade across every collection that references a
 * Clerk user id.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: Streak.name, schema: StreakSchema },
      { name: AiQuery.name, schema: AiQuerySchema },
      { name: VideoJob.name, schema: VideoJobSchema },
      { name: Call.name, schema: CallSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Message.name, schema: MessageSchema },
      { name: LeaderboardSnapshot.name, schema: LeaderboardSnapshotSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
