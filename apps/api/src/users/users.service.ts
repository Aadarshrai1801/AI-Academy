import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema.js';

/**
 * Phase 0: thin user service. Mongo is optional at runtime (see AppModule);
 * when the model is unavailable callers receive a dev stub instead of a crash.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async findByClerkId(clerkId: string): Promise<UserDocument | null> {
    return this.model.findOne({ clerkId }).exec();
  }

  async roleOf(clerkId: string): Promise<'free' | 'pro' | 'admin' | null> {
    const user = await this.model.findOne({ clerkId }).select('role status').lean().exec();
    if (!user || user.status !== 'active') return null;
    return user.role;
  }

  async setRole(clerkId: string, role: 'free' | 'pro' | 'admin') {
    return this.model.findOneAndUpdate({ clerkId }, { role }, { new: true }).exec();
  }

  async ensureUser(args: { clerkId: string; email: string; username: string }) {
    const existing = await this.findByClerkId(args.clerkId);
    if (existing) {
      existing.last_login_at = new Date();
      await existing.save();
      return existing;
    }
    return this.model.create({ ...args, role: 'free' });
  }

  async me(clerkId: string) {
    const user = await this.findByClerkId(clerkId);
    if (!user) return { clerkId, role: 'free', onboarded: false };
    return {
      clerkId: user.clerkId,
      email: user.email,
      username: user.username,
      role: user.role,
      points_total: user.points_total,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      onboarded: true,
    };
  }
}
