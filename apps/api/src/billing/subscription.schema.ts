import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mirrors spec §3 `subscriptions`. Local state is a CACHE of Stripe —
 * webhooks reconcile it; on mismatch the Stripe API wins (spec §6.3).
 */
export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Subscription {
  @Prop({ required: true })
  user_id!: string;

  @Prop({ default: 'stripe' })
  provider!: string;

  @Prop()
  provider_customer_id?: string;

  @Prop({ sparse: true, unique: true })
  provider_subscription_id?: string;

  @Prop({ enum: ['free', 'pro_monthly', 'pro_annual'], default: 'free' })
  plan!: string;

  @Prop({
    enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete'],
    default: 'active',
    index: true,
  })
  status!: string;

  @Prop()
  current_period_end?: Date;

  @Prop({ default: false })
  cancel_at_period_end!: boolean;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ user_id: 1 }, { unique: true });
