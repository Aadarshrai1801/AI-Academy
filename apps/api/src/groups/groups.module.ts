import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './group.schema.js';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';
import { GroupsService } from './groups.service.js';
import { GroupsController } from './groups.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]), LeaderboardModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService, MongooseModule],
})
export class GroupsModule {}
