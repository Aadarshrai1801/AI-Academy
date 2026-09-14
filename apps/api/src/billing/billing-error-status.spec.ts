import { HttpStatus } from '@nestjs/common';
import { billingErrorStatus } from './billing.controller.js';

/**
 * Regression: Stripe's `webhooks.constructEvent` throws a
 * `StripeSignatureVerificationError` that has `type` but no `status`, so the
 * old mapping fell through to 500. Stripe (and uptime monitors) then treated
 * every forged/replayed delivery as a server fault instead of a rejected 400.
 */
describe('billingErrorStatus', () => {
  it('maps Stripe signature verification failures to 400', () => {
    const err = Object.assign(new Error('No signatures found matching the expected signature for payload'), {
      type: 'StripeSignatureVerificationError',
    });
    expect(billingErrorStatus(err)).toBe(HttpStatus.BAD_REQUEST);
  });

  it('maps a missing stripe-signature header to 400', () => {
    const err = new Error('No stripe-signature header value was provided.');
    expect(billingErrorStatus(err)).toBe(HttpStatus.BAD_REQUEST);
  });

  it('keeps explicit status codes (503/404/400) intact', () => {
    expect(billingErrorStatus(Object.assign(new Error('unconfigured'), { status: 503 }))).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(billingErrorStatus(Object.assign(new Error('not found'), { status: 404 }))).toBe(HttpStatus.NOT_FOUND);
    expect(billingErrorStatus(Object.assign(new Error('bad body'), { status: 400 }))).toBe(HttpStatus.BAD_REQUEST);
  });

  it('falls back to 500 for unexpected errors', () => {
    expect(billingErrorStatus(new Error('mongo exploded'))).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(billingErrorStatus('not even an error')).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
