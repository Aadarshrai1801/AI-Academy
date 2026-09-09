import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from '../groups/group.schema.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }])],
  controllers: [RealtimeController],
})
export class RealtimeModule {}
