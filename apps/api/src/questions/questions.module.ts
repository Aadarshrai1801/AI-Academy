import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './question.schema.js';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { MasteryModule } from '../mastery/mastery.module.js';
import { QuestionsService } from './questions.service.js';
import { QuestionsController } from './questions.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Attempt.name, schema: AttemptSchema },
    ]),
    CurriculumModule,
    MasteryModule,
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService, MongooseModule],
})
export class QuestionsModule {}
