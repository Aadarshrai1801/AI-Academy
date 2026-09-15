import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LeaderboardSnapshot,
  LeaderboardSnapshotSchema,
} from './leaderboard-snapshot.schema.js';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { LeaderboardService } from './leaderboard.service.js';
import { LeaderboardController } from './leaderboard.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaderboardSnapshot.name, schema: LeaderboardSnapshotSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService, MongooseModule],
})
export class LeaderboardModule {}
