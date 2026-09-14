import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { IsEmail, IsIn } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/public.decorator.js';
import { BillingService } from './billing.service.js';

/** Map a billing error to an HTTP status. Exported for unit tests. */
export function billingErrorStatus(e: unknown): HttpStatus {
  const err = e as Error & { status?: number; type?: string };
  // Stripe signature/verification failures carry `type` but no status. They
  // must surface as 400: a forged delivery should be rejected as a client
  // error, and Stripe retries 5xx responses while treating 4xx as terminal.
  const missingSignatureHeader = /stripe-signature header/i.test(err.message ?? '');
  if (err.type === 'StripeSignatureVerificationError' || missingSignatureHeader) {
    return HttpStatus.BAD_REQUEST;
  }
  if (err.status === 503) return HttpStatus.SERVICE_UNAVAILABLE;
  if (err.status === 404) return HttpStatus.NOT_FOUND;
  if (err.status === 400) return HttpStatus.BAD_REQUEST;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

class CheckoutDto {
  @IsIn(['pro_monthly', 'pro_annual'])
  plan!: 'pro_monthly' | 'pro_annual';

  @IsEmail()
  email!: string;
}

/**
 * Stripe billing (spec §6.3): Checkout + Portal + idempotent webhooks.
 * Webhook uses the raw body (main.ts enables rawBody) for signature verification.
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @Public()
  status() {
    return {
      configured: this.billing.configured,
      plans: ['pro_monthly', 'pro_annual'],
      note: this.billing.configured
        ? 'Stripe live'
        : 'Set STRIPE_SECRET_KEY + STRIPE_PRICE_* to enable checkout',
    };
  }

  @Post('checkout')
  async checkout(@Req() req: { auth: { userId: string } }, @Body() dto: CheckoutDto) {
    try {
      return await this.billing.createCheckout(req.auth.userId, dto.email, dto.plan);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  @Post('portal')
  async portal(@Req() req: { auth: { userId: string } }) {
    try {
      return await this.billing.createPortal(req.auth.userId);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  @Post('stripe/webhook')
  @Public()
  @HttpCode(200)
  async webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      const raw = (req as { rawBody?: Buffer }).rawBody ?? (req.body as object);
      const event = this.billing.parseEvent(raw as Buffer | object, signature);
      return await this.billing.handleEvent(event);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  private toHttp(e: unknown): HttpException {
    const err = e as Error & { status?: number; type?: string };
    const status = billingErrorStatus(e);
    // Keep the observable error contract while avoiding leaking internals.
    const safeMessage = status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : err.message;
    return new HttpException({ statusCode: status, error: safeMessage }, status);
  }
}
