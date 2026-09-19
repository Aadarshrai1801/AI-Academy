import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * Mirrors spec §3 `users`. Clerk is the identity source of truth;
 * clerkId is unique. Role is cached here but enforced server-side per request.
 */
export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class User {
  @Prop({ required: true, unique: true, index: true })
  clerkId!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, unique: true, trim: true })
  username!: string;

  @Prop({ enum: ['free', 'pro', 'admin'], default: 'free', index: true })
  role!: 'free' | 'pro' | 'admin';

  @Prop({ default: 'UTC' })
  timezone!: string;

  @Prop()
  avatar_url?: string;

  @Prop({ default: 0 })
  points_total!: number;

  @Prop({ default: 0 })
  current_streak!: number;

  @Prop({ default: 0 })
  longest_streak!: number;

  @Prop({ type: String, default: null })
  last_activity_date!: string | null;

  @Prop({ default: 0 })
  streak_freezes_available!: number;

  /** `YYYY-MM` of the last monthly freeze refill (Pro/Admin). */
  @Prop({ type: String, default: null })
  streak_freeze_month!: string | null;

  @Prop({ type: String, default: null })
  subscription_id!: string | null;

  @Prop({ enum: ['active', 'suspended', 'deleted'], default: 'active' })
  status!: 'active' | 'suspended' | 'deleted';

  @Prop()
  last_login_at?: Date;

  /** Set once when the onboarding placement quiz is submitted (Phase 9). */
  @Prop({ type: Date, default: null })
  onboarding_diagnostic_completed_at?: Date | null;

  /** In-flight diagnostic question ids; cleared when the quiz is submitted. */
  @Prop({ type: [String], default: undefined })
  onboarding_diagnostic_question_ids?: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
