import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Mirrors spec §3 `messages` (+ reactions map, soft delete, report flags). */
export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group_id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  sender_id!: string;

  @Prop({ enum: ['text', 'image', 'file', 'question_share'], default: 'text' })
  type!: 'text' | 'image' | 'file' | 'question_share';

  @Prop({ required: true, maxlength: 4000 })
  content!: string;

  /** For question_share: the challenged question's id. */
  @Prop({ type: Types.ObjectId, ref: 'Question', default: undefined })
  question_id?: Types.ObjectId;

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
