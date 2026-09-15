import { BillingService } from './billing.service.js';

// BillingService takes Mongoose models; for pure webhook/validation logic,
// minimal fakes are enough (no DB touched). The `connection` fake has no
// startSession(), which exercises the standalone-Mongo fallback path in
// withTransaction().
const fakeSubs = {
  findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }),
};
const fakeUsers = { findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }) };

/** In-memory stand-in for the persistent webhook idempotency ledger. */
function fakeEvents() {
  const store = new Map<string, { status: string; updated_at: Date }>();
  return {
    findOne: (q: { event_id: string }) => ({
      lean: () => ({ exec: async () => store.get(q.event_id) ?? null }),
    }),
    create: async (doc: { event_id: string; type: string; status: string }) => {
      if (store.has(doc.event_id)) {
        const err = new Error('duplicate key') as Error & { code?: number };
        err.code = 11000;
        throw err;
      }
      store.set(doc.event_id, { status: doc.status, updated_at: new Date() });
      return doc;
    },
    updateOne: (q: { event_id: string }, update: { $set?: { status?: string } }) => ({
      exec: async () => {
        const cur = store.get(q.event_id);
        if (cur && update.$set?.status) cur.status = update.$set.status;
        return { ok: 1 };
      },
    }),
  };
}

const svc = () =>
  new BillingService(
    fakeSubs as never,
    fakeUsers as never,
    fakeEvents() as never,
    {} as never,
  );

describe('billing webhooks', () => {
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
    if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it('parses a Buffer body when no webhook secret is set (dev stub path)', () => {
    const evt = { id: 'evt_1', type: 'payment_intent.created', data: { object: {} } };
    const parsed = svc().parseEvent(Buffer.from(JSON.stringify(evt)), undefined);
    expect(parsed.id).toBe('evt_1');
    expect(parsed.type).toBe('payment_intent.created');
  });

  it('rejects invalid JSON bodies with 400', () => {
    expect(() => svc().parseEvent(Buffer.from('not-json{'), undefined)).toThrowError(/Invalid webhook/);
  });

  it('refuses unverified webhooks in production when the secret is missing', () => {
    process.env.NODE_ENV = 'production';
    let status: number | undefined;
    try {
      svc().parseEvent({ id: 'evt_x', type: 'x', data: { object: {} } }, undefined);
    } catch (e) {
      status = (e as { status?: number }).status;
    }
    expect(status).toBe(503);
  });

  it('dedupes repeat deliveries and ignores unknown event types', async () => {
    const s = svc();
    const evt = {
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: {
        object: { metadata: { userId: 'u1', plan: 'pro_monthly' }, customer: 'cus_1', subscription: 'sub_1' },
      },
    };
    expect(await s.handleEvent(evt as never)).toEqual({ handled: 'checkout.session.completed' });
    expect(await s.handleEvent(evt as never)).toEqual({ deduped: true });
    expect(await s.handleEvent({ id: 'evt_new', type: 'payment_intent.created', data: { object: {} } } as never))
      .toEqual({ ignored: 'payment_intent.created' });
  });
});

/** Async-iterator Stripe subscription list stand-in (auto-pagination path). */
function fakeStripeWithSubs(subs: unknown[]) {
  return {
    subscriptions: {
      list: () => ({
        [Symbol.asyncIterator]: async function* () {
          for (const s of subs) yield s;
        },
      }),
    },
  };
}

describe('billing revenue snapshot', () => {
  const svcWithStripe = (subs: unknown[]) => {
    const s = svc();
    (s as unknown as { stripe: unknown }).stripe = fakeStripeWithSubs(subs);
    return s;
  };

  it('normalizes annual prices to monthly MRR and counts every subscription', async () => {
    const s = svcWithStripe([
      { items: { data: [{ price: { unit_amount: 1000, recurring: { interval: 'month' } } }] } },
      { items: { data: [{ price: { unit_amount: 12000, recurring: { interval: 'year' } } }] } },
    ]);
    // $10/mo + $120/yr(=$10/mo) → $20 MRR, 2 active subs (not 12x-inflated).
    expect(await s.revenueSnapshot()).toEqual({ configured: true, activeSubs: 2, mrrUsd: 20 });
  });

  it('skips prices without recurring info instead of inflating MRR', async () => {
    const s = svcWithStripe([
      { items: { data: [{ price: { unit_amount: 99000, recurring: null } }] } },
      { items: { data: [{ price: { unit_amount: 500, recurring: { interval: 'month', interval_count: 3 } } }] } },
    ]);
    // One-time price skipped; $5 billed every 3 months → ~$1.67 MRR → rounds to 2.
    expect(await s.revenueSnapshot()).toEqual({ configured: true, activeSubs: 2, mrrUsd: 2 });
  });
});

describe('billing webhook user fallback (metadata-less events)', () => {
  const roleUpdates: Array<{ clerkId: string; role: string }> = [];
  const subRow = { user_id: 'u_portal', status: 'active' };
  const subs = {
    // Fallback lookups by Stripe customer/subscription id.
    findOne: (q: Record<string, unknown>) => ({
      lean: () => ({
        exec: async () =>
          q.provider_customer_id === 'cus_portal' || q.provider_subscription_id === 'sub_portal'
            ? subRow
            : null,
      }),
    }),
    findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }),
  };
  const users = {
    findOne: () => ({
      select: () => ({ lean: () => ({ exec: async () => ({ role: 'free' }) }) }),
    }),
    findOneAndUpdate: (q: { clerkId: string }, u: { role: string }) => {
      roleUpdates.push({ clerkId: q.clerkId, role: u.role });
      return { exec: async () => ({ ok: 1 }) };
    },
  };

  const fallbackSvc = () =>
    new BillingService(
      subs as never,
      users as never,
      fakeEvents() as never,
      {} as never,
    );

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test';
    roleUpdates.length = 0;
  });
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('resolves the user from the Stripe customer when metadata is missing (portal flow)', async () => {
    const evt = {
      id: 'evt_portal',
      type: 'customer.subscription.updated',
      data: {
        object: {
          metadata: {},
          customer: 'cus_portal',
          status: 'active',
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: 1900000000 }] },
        },
      },
    };
    expect(await fallbackSvc().handleEvent(evt as never)).toEqual({
      handled: 'customer.subscription.updated',
    });
    expect(roleUpdates).toEqual([{ clerkId: 'u_portal', role: 'pro' }]);
  });

  it('flags unresolvable subscription events instead of silently desyncing', async () => {
    const evt = {
      id: 'evt_orphan',
      type: 'customer.subscription.updated',
      data: {
        object: {
          metadata: {},
          customer: 'cus_unknown',
          status: 'active',
          items: { data: [{}] },
        },
      },
    };
    // Handled (200) — retrying would not help — but nothing was applied.
    expect(await fallbackSvc().handleEvent(evt as never)).toEqual({
      handled: 'customer.subscription.updated',
    });
    expect(roleUpdates).toEqual([]);
  });
});

describe('billing reconciliation', () => {
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedNodeEnv = process.env.NODE_ENV;

  it('counts unresolved subscriptions and repairs desynced ones', async () => {
    const roleUpdates: Array<{ clerkId: string; role: string }> = [];
    const subsRow = { user_id: 'u_known', status: 'active' };
    const subs = {
      findOne: (q: Record<string, unknown>) => ({
        lean: () => ({
          exec: async () =>
            q.provider_customer_id === 'cus_known' ||
            q.provider_subscription_id === 'sub_known' ||
            q.user_id === 'u_known'
              ? subsRow
              : null,
        }),
      }),
      findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }),
    };
    const users = {
      findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => ({ role: 'pro' }) }) }) }),
      findOneAndUpdate: (q: { clerkId: string }, u: { role: string }) => {
        roleUpdates.push({ clerkId: q.clerkId, role: u.role });
        return { exec: async () => ({ ok: 1 }) };
      },
    };
    const s = new BillingService(subs as never, users as never, fakeEvents() as never, {} as never);
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.NODE_ENV = 'test';
    (s as unknown as { stripe: unknown }).stripe = fakeStripeWithSubs([
      // In-sync active sub (metadata-resolved) → skipped.
      { id: 'sub_known', customer: 'cus_known', status: 'active', metadata: { userId: 'u_known' },
        cancel_at_period_end: false, items: { data: [{ current_period_end: 1900000000 }] } },
      // No resolvable user → unresolved.
      { id: 'sub_ghost', customer: 'cus_ghost', status: 'active', metadata: {},
        cancel_at_period_end: false, items: { data: [{}] } },
      // Desynced: Stripe says canceled, DB still says active → repaired to free.
      { id: 'sub_stale', customer: 'cus_known', status: 'canceled', metadata: { userId: 'u_known' },
        cancel_at_period_end: false, items: { data: [{}] } },
    ]);
    try {
      const result = await s.reconcile();
      expect(result).toEqual({ checked: 3, updated: 1, unresolved: 1 });
      expect(roleUpdates).toEqual([{ clerkId: 'u_known', role: 'free' }]);
    } finally {
      if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = savedKey;
      process.env.NODE_ENV = savedNodeEnv;
    }
  });
});
