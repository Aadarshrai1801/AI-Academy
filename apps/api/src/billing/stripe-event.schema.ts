import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Persistent Stripe webhook idempotency ledger. Stripe can deliver the same
 * event more than once (retries, manual replays); the in-memory Set this
 * replaces was lost on every restart, so a redeploy could double-apply a
 * subscription change.
 *
 * Lifecycle: `processing` → `processed`, or `processing` → `failed` (Stripe's
 * next retry reclaims the record and reprocesses it).
 */
export type StripeEventDocument = HydratedDocument<StripeEvent>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StripeEvent {
  @Prop({ required: true, unique: true, index: true })
  event_id!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ enum: ['processing', 'processed', 'failed'], default: 'processing', index: true })
  status!: 'processing' | 'processed' | 'failed';

  @Prop()
  error?: string;
}

export const StripeEventSchema = SchemaFactory.createForClass(StripeEvent);
