import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TopicMastery, TopicMasterySchema } from './topic-mastery.schema.js';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { MasteryController } from './mastery.controller.js';
import { DiagnosticController } from './diagnostic.controller.js';
import { MasteryService } from './mastery.service.js';

/**
 * Adaptive mastery: per-topic scores, time decay, the onboarding diagnostic,
 * and `GET /users/me/mastery`. Depends only on schemas so `attempts` can
 * import it without cycles.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TopicMastery.name, schema: TopicMasterySchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MasteryController, DiagnosticController],
  providers: [MasteryService],
  exports: [MasteryService],
})
export class MasteryModule {}
