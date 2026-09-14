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
    const status =
      err.status === 503
        ? HttpStatus.SERVICE_UNAVAILABLE
        : err.status === 404
          ? HttpStatus.NOT_FOUND
          : err.status === 400
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.INTERNAL_SERVER_ERROR;
    return new HttpException({ statusCode: status, error: err.message }, status);
  }
}
