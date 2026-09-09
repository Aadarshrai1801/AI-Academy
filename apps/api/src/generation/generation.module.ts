import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../questions/question.schema.js';
import { LlmModule } from '../llm/llm.module.js';
import { GenerationService } from './generation.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }]), LlmModule],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
