import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Call, CallSchema } from './call.schema.js';
import { GroupsModule } from '../groups/groups.module.js';
import { CallsService } from './calls.service.js';
import { CallsController } from './calls.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]), GroupsModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService, MongooseModule],
})
export class CallsModule {}
