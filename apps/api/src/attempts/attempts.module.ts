import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attempt, AttemptSchema } from './attempt.schema.js';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Streak, StreakSchema } from '../streaks/streak.schema.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { MasteryModule } from '../mastery/mastery.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController } from './attempts.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attempt.name, schema: AttemptSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
      { name: Streak.name, schema: StreakSchema },
    ]),
    StreaksModule,
    LeaderboardModule,
    CurriculumModule,
    MasteryModule,
    MessagesModule,
  ],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
