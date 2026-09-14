import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Mirrors spec §3 `leaderboard_snapshots` — persisted history; live ranks in Redis. */
export type SnapshotDocument = HydratedDocument<LeaderboardSnapshot>;

@Schema({ timestamps: { createdAt: 'generated_at', updatedAt: false } })
export class LeaderboardSnapshot {
  @Prop({ enum: ['daily', 'weekly', 'monthly'], required: true })
  period_type!: string;

  @Prop({ required: true })
  period_key!: string;

  @Prop({ type: [{ user_id: String, username: String, rank: Number, score: Number, accuracy: Number }], default: [] })
  entries!: Array<{ user_id: string; username: string; rank: number; score: number; accuracy: number }>;
}

export const LeaderboardSnapshotSchema = SchemaFactory.createForClass(LeaderboardSnapshot);
LeaderboardSnapshotSchema.index({ period_type: 1, period_key: 1 }, { unique: true });
