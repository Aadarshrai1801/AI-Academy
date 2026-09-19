import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema.js';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { CurriculumController } from './curriculum.controller.js';
import { CurriculumService } from './curriculum.service.js';

/**
 * Learning-path module: owns the prerequisite DAG, per-topic gate state, and
 * `GET /topics/graph`. Depends only on schemas (no feature modules) so both
 * `questions` and `attempts` can import it without cycles.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attempt.name, schema: AttemptSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
