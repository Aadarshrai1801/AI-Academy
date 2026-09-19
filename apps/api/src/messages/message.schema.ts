import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { type HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `messages` (+ reactions map, soft delete, report flags). */
export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Message {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Group', required: false, index: true })
  group_id?: mongoose.Types.ObjectId;

  /** Conversation ID for 1:1 direct messages (e.g. sorted 'userA:userB'). */
  @Prop({ index: true })
  conversation_id?: string;

  @Prop({ required: true, index: true })
  sender_id!: string;

  /** Direct message recipient id. */
  @Prop({ index: true })
  recipient_id?: string;

  @Prop({ enum: ['text', 'image', 'file', 'question_share', 'study_prompt'], default: 'text' })
  type!: 'text' | 'image' | 'file' | 'question_share' | 'study_prompt';

  @Prop({ required: true, maxlength: 4000 })
  content!: string;

  /** For question_share: the challenged question's id. */
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Question', default: undefined })
  question_id?: mongoose.Types.ObjectId;

  @Prop()
  media_url?: string;

  @Prop()
  edited_at?: Date;

  @Prop({ default: false })
  deleted!: boolean;

  @Prop({ type: [String], default: [] })
  read_by!: string[];

  /** emoji → user ids (toggle semantics). */
  @Prop({ type: Map, of: [String], default: {} })
  reactions!: Map<string, string[]>;

  @Prop({ default: false, index: true })
  flagged!: boolean;

  @Prop()
  flag_reason?: string;

  created_at?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ group_id: 1, created_at: -1 });
MessageSchema.index({ group_id: 1, _id: -1 });
MessageSchema.index({ conversation_id: 1, created_at: -1 });
MessageSchema.index({ conversation_id: 1, _id: -1 });
MessageSchema.index({ recipient_id: 1, created_at: -1 });
MessageSchema.index({ sender_id: 1, created_at: -1 });
