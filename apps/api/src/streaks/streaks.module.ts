import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Streak, StreakSchema } from './streak.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { StreaksService } from './streaks.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Streak.name, schema: StreakSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [StreaksService],
  exports: [StreaksService, MongooseModule],
})
export class StreaksModule {}
