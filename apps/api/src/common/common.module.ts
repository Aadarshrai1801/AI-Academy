import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from './redis.module.js';
import { UsersModule } from '../users/users.module.js';
import { EntitlementsService } from './entitlements.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { QuotaGuard } from './quota.guard.js';
import { ThrottleGuard } from './throttle.guard.js';

/** Global shared providers: entitlements, auth, quota, edge throttle (spec §2.7, §5.2). */
@Global()
@Module({
  imports: [RedisModule, UsersModule],
  providers: [
    EntitlementsService,
    ClerkAuthGuard,
    QuotaGuard,
    { provide: APP_GUARD, useClass: ThrottleGuard },
  ],
  exports: [EntitlementsService, ClerkAuthGuard, QuotaGuard, UsersModule],
})
export class CommonModule {}
