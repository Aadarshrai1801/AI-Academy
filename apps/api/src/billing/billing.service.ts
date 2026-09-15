import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription, SubscriptionDocument } from './subscription.schema.js';
import { StripeEvent, StripeEventDocument } from './stripe-event.schema.js';
import { User, UserDocument } from '../users/user.schema.js';
import { withTransaction } from '../common/mongo-transaction.js';

/** How long a `processing` event may stay unfinished before a retry reclaims it. */
const PROCESSING_STALE_MS = 5 * 60 * 1000;

const isDuplicateKey = (err: unknown): boolean =>
  (err as { code?: number } | null)?.code === 11000;

/**
 * Stripe billing (spec §6.3): Checkout + Customer Portal + reconciling webhooks.
 * Without STRIPE_SECRET_KEY every route degrades to a clear 503 stub so local
 * dev works with zero cloud keys.
 *
 * Webhook idempotency is persisted (stripe_events collection) and the
 * subscription + role update commit in one Mongo transaction where supported.
 */
@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger('Billing');

  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(StripeEvent.name) private readonly events: Model<StripeEventDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
  }

  get configured() {
    return this.stripe !== null;
  }

  /** MRR snapshot for the admin dashboard (Stripe is source of truth). */
  async revenueSnapshot(): Promise<{ configured: boolean; activeSubs: number | null; mrrUsd: number | null }> {
    if (!this.stripe) return { configured: false, activeSubs: null, mrrUsd: null };
    try {
      let activeSubs = 0;
      let mrrCents = 0;
      // Auto-paginate: a fixed limit-100 snapshot silently undercounted revenue.
      for await (const s of this.stripe.subscriptions.list({ status: 'active', limit: 100 })) {
        activeSubs++;
        for (const item of s.items.data) {
          const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
          const recurring = item.price.recurring;
          if (!recurring) continue;
          const count = recurring.interval_count ?? 1;
          // Normalize every interval to one month — an annual price must count
          // as amount/12 of MRR, not 12x MRR.
          const months =
            recurring.interval === 'month'
              ? count
              : recurring.interval === 'year'
                ? 12 * count
                : recurring.interval === 'week'
                  ? (52 / 12) * count
                  : (365 / 12) * count; // day
          if (!Number.isFinite(months) || months <= 0) continue;
          mrrCents += amount / months;
        }
      }
      return { configured: true, activeSubs, mrrUsd: Math.round(mrrCents / 100) };
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
      // No signature verification possible — anyone can forge events.
      // Refuse in production; dev keeps the JSON stub path.
      if (process.env.NODE_ENV === 'production') {
        throw Object.assign(new Error('Stripe webhook secret not configured (set STRIPE_WEBHOOK_SECRET)'), {
          status: 503,
        });
      }
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

  /**
   * Deduplicate + apply one Stripe event.
   * - Already `processed` → no-op.
   * - Fresh `processing` (another delivery in flight) → no-op.
   * - `failed` or stale `processing` → reclaim and retry.
   */
  async handleEvent(event: Stripe.Event) {
    const existing = await this.events.findOne({ event_id: event.id }).lean().exec();
    if (existing?.status === 'processed') return { deduped: true };
    if (existing?.status === 'processing') {
      const updatedAt = (existing as { updated_at?: Date }).updated_at?.getTime() ?? 0;
      if (Date.now() - updatedAt < PROCESSING_STALE_MS) return { deduped: true };
    }

    if (existing) {
      await this.events
        .updateOne({ event_id: event.id }, { $set: { status: 'processing', error: undefined } })
        .exec();
    } else {
      try {
        await this.events.create({ event_id: event.id, type: event.type, status: 'processing' });
      } catch (err) {
        if (isDuplicateKey(err)) return { deduped: true }; // concurrent delivery
        throw err;
      }
    }

    try {
      const result = await this.dispatch(event);
      await this.events.updateOne({ event_id: event.id }, { $set: { status: 'processed' } }).exec();
      return result;
    } catch (err) {
      await this.events
        .updateOne(
          { event_id: event.id },
          { $set: { status: 'failed', error: (err as Error).message.slice(0, 300) } },
        )
        .exec()
        .catch(() => undefined);
      throw err; // non-2xx → Stripe retries
    }
  }

  /**
   * Fallback user resolution when Stripe metadata is missing (Customer-Portal
   * initiated changes, subscriptions created before metadata conventions).
   * Looks up our subscription cache by Stripe customer / subscription id.
   */
  private async resolveUserIdFromCustomer(customerId?: string | null): Promise<string | undefined> {
    if (!customerId) return undefined;
    const sub = await this.subs.findOne({ provider_customer_id: customerId }).lean().exec();
    return (sub as { user_id?: string } | null)?.user_id;
  }

  private async resolveUserIdFromSubscription(subscriptionId?: string | null): Promise<string | undefined> {
    if (!subscriptionId) return undefined;
    const sub = await this.subs.findOne({ provider_subscription_id: subscriptionId }).lean().exec();
    return (sub as { user_id?: string } | null)?.user_id;
  }

  private async dispatch(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId =
          s.metadata?.userId ?? (await this.resolveUserIdFromCustomer(s.customer as string | undefined));
        const plan = (s.metadata?.plan ?? 'pro_monthly') as string;
        if (!userId) {
          this.logger.warn(`checkout.session.completed ${event.id}: no userId — event not applied`);
          break;
        }
        await this.applySubscription(
          userId,
          {
            plan,
            status: 'active',
            provider_customer_id: (s.customer as string) ?? undefined,
            provider_subscription_id: (s.subscription as string) ?? undefined,
          },
          'pro',
        );
        break;
      }
      case 'customer.subscription.updated': {
        const s = event.data.object as Stripe.Subscription;
        const userId =
          s.metadata?.userId ??
          (await this.resolveUserIdFromSubscription(s.id)) ??
          (await this.resolveUserIdFromCustomer(s.customer as string | undefined));
        if (!userId) {
          this.logger.warn(`customer.subscription.updated ${event.id}: no userId — event not applied (run POST /admin/billing/reconcile)`);
          break;
        }
        const active = ['active', 'trialing'].includes(s.status);
        const firstItem = s.items.data[0] as unknown as { current_period_end?: number } | undefined;
        await this.applySubscription(
          userId,
          {
            status: s.status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled',
            provider_customer_id: (s.customer as string) ?? undefined,
            provider_subscription_id: s.id,
            current_period_end: new Date((firstItem?.current_period_end ?? 0) * 1000 || Date.now()),
            cancel_at_period_end: s.cancel_at_period_end,
          },
          active || s.status === 'past_due' ? 'pro' : 'free',
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const s = event.data.object as Stripe.Subscription;
        const userId =
          s.metadata?.userId ??
          (await this.resolveUserIdFromSubscription(s.id)) ??
          (await this.resolveUserIdFromCustomer(s.customer as string | undefined));
        if (!userId) {
          this.logger.warn(`customer.subscription.deleted ${event.id}: no userId — event not applied (run POST /admin/billing/reconcile)`);
          break;
        }
        await this.applySubscription(userId, { status: 'canceled' }, 'free');
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = (inv as { subscription_details?: { metadata?: { userId?: string } } }).subscription_details?.metadata?.userId
          ?? (inv.metadata as Record<string, string> | null)?.userId
          ?? (await this.resolveUserIdFromCustomer(inv.customer as string | undefined));
        if (!userId) {
          this.logger.warn(`invoice.paid ${event.id}: no userId — event not applied (run POST /admin/billing/reconcile)`);
          break;
        }
        await this.applySubscription(userId, { status: 'active' }, 'pro');
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = (inv.metadata as Record<string, string> | null)?.userId
          ?? (await this.resolveUserIdFromCustomer(inv.customer as string | undefined));
        if (!userId) {
          this.logger.warn(`invoice.payment_failed ${event.id}: no userId — event not applied (run POST /admin/billing/reconcile)`);
          break;
        }
        await this.applySubscription(userId, { status: 'past_due' }, null);
        // Grace period: keep Pro until subscription.deleted (spec §6.3 dunning).
        break;
      }
      default:
        return { ignored: event.type };
    }
    return { handled: event.type };
  }

  /**
   * Stripe → DB reconciliation: walk every Stripe subscription and repair
   * rows that desynced from webhooks (missed deliveries, downtime, metadata-
   * less portal changes). Invoked via POST /admin/billing/reconcile (audited)
   * or an operator cron. Idempotent — only writes when state actually differs.
   */
  async reconcile(): Promise<{ checked: number; updated: number; unresolved: number }> {
    const stripe = this.requireStripe();
    let checked = 0;
    let updated = 0;
    let unresolved = 0;
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      checked++;
      const userId =
        s.metadata?.userId ??
        (await this.resolveUserIdFromSubscription(s.id)) ??
        (await this.resolveUserIdFromCustomer(s.customer as string | undefined));
      if (!userId) {
        unresolved++;
        continue;
      }
      const active = ['active', 'trialing'].includes(s.status);
      const status = s.status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled';
      const role: 'pro' | 'free' = active || s.status === 'past_due' ? 'pro' : 'free';
      const firstItem = s.items.data[0] as unknown as { current_period_end?: number } | undefined;
      const cur = (await this.subs.findOne({ user_id: userId }).lean().exec()) as { status?: string } | null;
      const user = (await this.users
        .findOne({ clerkId: userId })
        .select('role')
        .lean()
        .exec()) as { role?: string } | null;
      if (cur?.status === status && user?.role === role) continue;
      await this.applySubscription(
        userId,
        {
          status,
          provider_customer_id: (s.customer as string) ?? undefined,
          provider_subscription_id: s.id,
          current_period_end: new Date((firstItem?.current_period_end ?? 0) * 1000 || Date.now()),
          cancel_at_period_end: s.cancel_at_period_end,
        },
        role,
      );
      updated++;
    }
    this.logger.log(`reconcile: checked=${checked} updated=${updated} unresolved=${unresolved}`);
    return { checked, updated, unresolved };
  }

  /**
   * Subscription cache + role are one logical state change; commit them
   * together (transaction where supported) so a crash cannot leave a Pro user
   * with a canceled subscription row or vice versa.
   */
  private async applySubscription(
    userId: string,
    patch: Partial<Subscription>,
    role: 'free' | 'pro' | null,
  ) {
    await withTransaction(this.connection, async (session) => {
      await this.subs
        .findOneAndUpdate(
          { user_id: userId },
          { $set: patch },
          { upsert: true, ...(session ? { session } : {}) },
        )
        .exec();
      if (role) {
        await this.users
          .findOneAndUpdate({ clerkId: userId }, { role }, session ? { session } : {})
          .exec();
      }
    });
  }
}
