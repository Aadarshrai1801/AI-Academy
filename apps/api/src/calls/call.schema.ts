import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { type HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `calls` (+ active status, invitee, moderation flags). */
export type CallDocument = HydratedDocument<Call>;

@Schema({ timestamps: { createdAt: 'started_at', updatedAt: 'updated_at' } })
export class Call {
  @Prop({ required: true, index: true })
  initiator_id!: string;

  @Prop({ type: [String], default: [] })
  participant_ids!: string[];

  /** Everyone who ever joined (history stays visible after leaving). */
  @Prop({ type: [String], default: [] })
  all_participant_ids!: string[];

  /** 1:1 invitee (null for group calls). */
  @Prop({ type: String, default: null })
  invitee_id!: string | null;

  @Prop({ type: mongoose.Types.ObjectId, ref: 'Group', default: undefined, index: true })
  group_id?: mongoose.Types.ObjectId;

  @Prop({ enum: ['1:1', 'group'], required: true })
  type!: '1:1' | 'group';

  @Prop()
  ended_at?: Date;

  @Prop({ default: 0 })
  duration_sec!: number;

  @Prop({ default: false })
  screen_share_used!: boolean;

  @Prop({ required: true, unique: true, index: true })
  sfu_room_id!: string;

  @Prop({ enum: ['active', 'completed', 'missed', 'failed'], default: 'active', index: true })
  status!: 'active' | 'completed' | 'missed' | 'failed';

  @Prop({ default: false, index: true })
  flagged!: boolean;

  @Prop()
  flag_reason?: string;

  started_at?: Date;
}

export const CallSchema = SchemaFactory.createForClass(Call);
CallSchema.index({ participant_ids: 1, status: 1 });
CallSchema.index({ all_participant_ids: 1 });
