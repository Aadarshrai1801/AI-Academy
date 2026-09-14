import { Controller, Optional, Post, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import Ably from 'ably';
import { Group, GroupDocument } from '../groups/group.schema.js';

/**
 * Realtime negotiation (spec §2.4, §4: start with Ably).
 * - With ABLY_API_KEY: short-lived token request scoped to the caller's
 *   groups (subscribe/publish/presence/history). Client connects lazily.
 * - Without: explicit polling directive — same history API, 3s interval.
 */
@Controller('realtime')
export class RealtimeController {
  constructor(@InjectModel(Group.name) @Optional() private readonly groups?: Model<GroupDocument>) {}

  @Post('token')
  async token(@Req() req: { auth: { userId: string } }) {
    const key = process.env.ABLY_API_KEY;
    if (!key) return { mode: 'polling', intervalMs: 3000 };

    const mine = this.groups
      ? await this.groups.find({ deleted: false, member_ids: req.auth.userId }).select('_id').lean().exec()
      : [];
    const capability: Record<string, string[]> = {};
    for (const g of mine) capability[`group:${String(g._id)}`] = ['subscribe', 'publish', 'presence', 'history'];

    const rest = new Ably.Rest(key);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: req.auth.userId,
      capability: JSON.stringify(capability),
      ttl: 3600000,
    });
    return { mode: 'ably', tokenRequest };
  }
}
