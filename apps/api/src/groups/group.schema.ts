import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `groups` (+ soft delete for retention policy). */
export type GroupDocument = HydratedDocument<Group>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Group {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop()
  avatar_url?: string;

  @Prop({ required: true, index: true })
  owner_id!: string;

  @Prop({ enum: ['invite_only', 'public'], default: 'invite_only' })
  privacy!: 'invite_only' | 'public';

  /**
   * Group culture: 'competitive' keeps the daily ranking board; 'study'
   * hides rankings and posts recently-missed questions to the chat feed
   * for discussion (Phase 11). Default preserves existing behavior.
   */
  @Prop({ enum: ['competitive', 'study'], default: 'competitive', index: true })
  mode!: 'competitive' | 'study';

  @Prop({ type: [String], default: [] })
  member_ids!: string[];

  @Prop({ default: 0 })
  member_count!: number;

  @Prop({ required: true })
  max_members!: number;

  @Prop({ required: true, unique: true, index: true })
  invite_code!: string;

  @Prop()
  invite_code_expires_at?: Date;

  @Prop({ default: false })
  deleted!: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ owner_id: 1, deleted: 1 });
GroupSchema.index({ member_ids: 1, deleted: 1 });
