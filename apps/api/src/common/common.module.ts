import { Global, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from './redis.module.js';
import { UsersModule } from '../users/users.module.js';
import { EntitlementsService } from './entitlements.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { QuotaGuard } from './quota.guard.js';
import { ThrottleGuard } from './throttle.guard.js';
import { KeepaliveService } from './keepalive.service.js';
import { IdempotencyMiddleware } from './idempotency.middleware.js';
import { QuotaUsage, QuotaUsageSchema } from './quota-usage.schema.js';

/**
 * Global shared providers: entitlements, auth, quota, edge throttle (spec §2.7, §5.2).
 *
 * ClerkAuthGuard is registered globally (deny-by-default). New routes are
 * authenticated unless they explicitly opt out with `@Public()`. Guard order
 * matters: auth runs first so the throttle can key on the resolved user id.
 */
@Global()
@Module({
  imports: [RedisModule, UsersModule, MongooseModule.forFeature([{ name: QuotaUsage.name, schema: QuotaUsageSchema }])],
  providers: [
    EntitlementsService,
    ClerkAuthGuard,
    QuotaGuard,
    KeepaliveService,
    IdempotencyMiddleware,
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: ThrottleGuard },
  ],
  exports: [EntitlementsService, ClerkAuthGuard, QuotaGuard, UsersModule],
})
export class CommonModule implements NestModule {
  /**
   * Server-side Idempotency-Key enforcement on non-idempotent POSTs (the web
   * client already sends the header). Kept to an explicit allow-list so
   * webhook receivers (Stripe retries on 4xx/5xx) are unaffected.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdempotencyMiddleware).forRoutes(
      { path: 'attempts', method: RequestMethod.POST },
      { path: 'billing/checkout', method: RequestMethod.POST },
      { path: 'billing/portal', method: RequestMethod.POST },
      { path: 'ai/ask', method: RequestMethod.POST },
      { path: 'ai/videos', method: RequestMethod.POST },
    );
  }
}
