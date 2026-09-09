import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription, SubscriptionDocument } from './subscription.schema.js';
import { User, UserDocument } from '../users/user.schema.js';

/**
 * Stripe billing (spec §6.3): Checkout + Customer Portal + reconciling webhooks.
 * Without STRIPE_SECRET_KEY every route degrades to a clear 503 stub so local
 * dev works with zero cloud keys.
 */
@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;
  private seenEvents = new Set<string>(); // Phase 1 idempotency; move to DB at scale.

  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
  }

  get configured() {
    return this.stripe !== null;
  }

  /** Rough MRR snapshot for the admin dashboard (Stripe is source of truth). */
  async revenueSnapshot(): Promise<{ configured: boolean; activeSubs: number | null; mrrUsd: number | null }> {
    if (!this.stripe) return { configured: false, activeSubs: null, mrrUsd: null };
    try {
      const subs = await this.stripe.subscriptions.list({ status: 'active', limit: 100 });
      let mrrCents = 0;
      for (const s of subs.data) {
        for (const item of s.items.data) {
          mrrCents += (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
        }
      }
      return { configured: true, activeSubs: subs.data.length, mrrUsd: Math.round(mrrCents / 100) };
    } catch {
      return { configured: true, activeSubs: null, mrrUsd: null };
    }
  }

  private requireStripe() {
    if (!this.stripe) {
      const err = new Error('Stripe not configured (set STRIPE_SECRET_KEY)') as Error & { status: number };
      err.status = 503;
      throw err;
    }
    return this.stripe;
  }

  async createCheckout(userId: string, email: string, plan: 'pro_monthly' | 'pro_annual') {
    const stripe = this.requireStripe();
    // Read price IDs at call time (after ConfigModule has loaded .env).
    const price =
      plan === 'pro_monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL;
    if (!price) throw Object.assign(new Error(`Price not configured for ${plan}`), { status: 503 });
    const webapp = process.env.WEBAPP_URL ?? 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${webapp}/dashboard?upgraded=1`,
      cancel_url: `${webapp}/pricing?canceled=1`,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });
    return { url: session.url };
  }

  async createPortal(userId: string) {
    const stripe = this.requireStripe();
    const sub = await this.subs.findOne({ user_id: userId }).lean().exec();
    if (!sub?.provider_customer_id) {
      throw Object.assign(new Error('No Stripe customer yet — subscribe first'), { status: 404 });
    }
    const webapp = process.env.WEBAPP_URL ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.provider_customer_id,
      return_url: `${webapp}/dashboard`,
    });
    return { url: session.url };
  }

  /** Verify signature when a secret is set; accept parsed dev events otherwise. */
  parseEvent(rawBody: Buffer | object, signature?: string): Stripe.Event {
    const stripe = this.requireStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && rawBody instanceof Buffer) {
      return stripe.webhooks.constructEvent(rawBody, signature ?? '', secret);
    }
    if (!secret) {
      // main.ts sets rawBody:true so live requests arrive as Buffer even in dev.
      // Parse it back to JSON instead of returning the Buffer as an event.
      if (rawBody instanceof Buffer) {
        try {
          return JSON.parse(rawBody.toString('utf8')) as Stripe.Event;
        } catch {
          throw Object.assign(new Error('Invalid webhook JSON body'), { status: 400 });
        }
      }
      return rawBody as Stripe.Event; // local dev stub path
    }
    throw Object.assign(new Error('Webhook requires raw body (see main.ts wiring)'), { status: 400 });
  }

  async handleEvent(event: Stripe.Event) {
    if (this.seenEvents.has(event.id)) return { deduped: true };
    this.seenEvents.add(event.id);

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId;
        const plan = (s.metadata?.plan ?? 'pro_monthly') as string;
        if (!userId) break;
        await this.upsertSub(userId, {
          plan,
          status: 'active',
          provider_customer_id: (s.customer as string) ?? undefined,
          provider_subscription_id: (s.subscription as string) ?? undefined,
        });
        await this.setRole(userId, 'pro');
        break;
      }
      case 'customer.subscription.updated': {
        const s = event.data.object as Stripe.Subscription;
        const userId = s.metadata?.userId;
        if (!userId) break;
        const active = ['active', 'trialing'].includes(s.status);
        const firstItem = s.items.data[0] as unknown as { current_period_end?: number } | undefined;
        await this.upsertSub(userId, {
          status: s.status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled',
          provider_customer_id: (s.customer as string) ?? undefined,
          provider_subscription_id: s.id,
          current_period_end: new Date((firstItem?.current_period_end ?? 0) * 1000 || Date.now()),
          cancel_at_period_end: s.cancel_at_period_end,
        });
        await this.setRole(userId, active || s.status === 'past_due' ? 'pro' : 'free');
        break;
      }
      case 'customer.subscription.deleted': {
        const s = event.data.object as Stripe.Subscription;
        const userId = s.metadata?.userId;
        if (!userId) break;
        await this.upsertSub(userId, { status: 'canceled' });
        await this.setRole(userId, 'free');
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = (inv as { subscription_details?: { metadata?: { userId?: string } } }).subscription_details?.metadata?.userId
          ?? (inv.metadata as Record<string, string> | null)?.userId;
        if (!userId) break;
        await this.upsertSub(userId, { status: 'active' });
        await this.setRole(userId, 'pro');
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = (inv.metadata as Record<string, string> | null)?.userId;
        if (!userId) break;
        await this.upsertSub(userId, { status: 'past_due' });
        // Grace period: keep Pro until subscription.deleted (spec §6.3 dunning).
        break;
      }
      default:
        return { ignored: event.type };
    }
    return { handled: event.type };
  }

  private async upsertSub(userId: string, patch: Partial<Subscription>) {
    await this.subs.findOneAndUpdate({ user_id: userId }, { $set: patch }, { upsert: true }).exec();
  }

  private async setRole(userId: string, role: 'free' | 'pro') {
    await this.users.findOneAndUpdate({ clerkId: userId }, { role }).exec();
  }
}
