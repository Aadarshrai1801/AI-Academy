import { BillingService } from './billing.service.js';

// BillingService takes Mongoose models; for pure webhook/validation logic,
// minimal fakes are enough (no DB touched).
const fakeSubs = {
  findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }),
};
const fakeUsers = { findOneAndUpdate: () => ({ exec: async () => ({ ok: 1 }) }) };

const svc = () =>
  new BillingService(
    fakeSubs as never,
    fakeUsers as never,
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
