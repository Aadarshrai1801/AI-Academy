import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from './redis.module.js';
import { UsersModule } from '../users/users.module.js';
import { EntitlementsService } from './entitlements.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { QuotaGuard } from './quota.guard.js';
import { ThrottleGuard } from './throttle.guard.js';
import { KeepaliveService } from './keepalive.service.js';

/**
 * Global shared providers: entitlements, auth, quota, edge throttle (spec §2.7, §5.2).
 *
 * ClerkAuthGuard is registered globally (deny-by-default). New routes are
 * authenticated unless they explicitly opt out with `@Public()`. Guard order
 * matters: auth runs first so the throttle can key on the resolved user id.
 */
@Global()
@Module({
  imports: [RedisModule, UsersModule],
  providers: [
    EntitlementsService,
    ClerkAuthGuard,
    QuotaGuard,
    KeepaliveService,
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: ThrottleGuard },
  ],
  exports: [EntitlementsService, ClerkAuthGuard, QuotaGuard, UsersModule],
})
export class CommonModule {}
