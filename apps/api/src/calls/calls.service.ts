import { HttpException, HttpStatus, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import { Queue, Worker } from 'bullmq';
import { Call, CallDocument } from './call.schema.js';
import { GroupsService } from '../groups/groups.service.js';
import { EntitlementsService, Role } from '../common/entitlements.service.js';
import { newBullConnection, workerTuning } from '../common/bull-connection.js';
import { incCounter } from '../common/metrics.js';
import { MAX_GROUP_CALL_SIZE, canStartGroupCall, capMinutesFor, minutesForDuration } from './policy.js';

export const CALL_TIMER_QUEUE = 'call-timers';

interface Rtk {
  account: string;
  app: string;
  token: string;
  preset: string;
  presetHost: string;
}

/**
 * Video calls: Cloudflare RealtimeKit WebRTC with server-side duration caps,
 * per-minute quota billing, screen-share grants by tier, and abuse reporting.
 */
@Injectable()
export class CallsService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    @InjectModel(Call.name) private readonly calls: Model<CallDocument>,
    private readonly groups: GroupsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private rtk(): Rtk | null {
    const account = process.env.RTK_ACCOUNT_ID;
    const app = process.env.RTK_APP_ID;
    const token = process.env.RTK_API_TOKEN;
    if (!account || !app || !token) return null;
    return {
      account,
      app,
      token,
      preset: process.env.RTK_PRESET_NAME ?? process.env.RTK_PRESET_PARTICIPANT ?? 'group_call_participant',
      presetHost: process.env.RTK_PRESET_HOST ?? 'group_call_host',
    };
  }

  private rtkBase(): string | null {
    const r = this.rtk();
    if (!r) return null;
    return `https://api.cloudflare.com/client/v4/accounts/${r.account}/realtime/kit/${r.app}`;
  }

  private rtkHeaders(): Record<string, string> | null {
    const r = this.rtk();
    if (!r) return null;
    return { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' };
  }

  get live() {
    return this.rtk() !== null;
  }

  get provider(): 'rtk' | null {
    if (this.rtk()) return 'rtk';
    return null;
  }

  async onModuleInit() {
    // Always visible in deploy logs: missing RTK keys is the #1 reason rooms
    // land on the "media keys pending" notice instead of live video.
    // eslint-disable-next-line no-console
    console.log(
      `[calls] sfu provider: ${this.provider ?? 'missing-keys (set RTK_ACCOUNT_ID/RTK_APP_ID/RTK_API_TOKEN)'}`,
    );
    if (!process.env.REDIS_URL) return;
    this.queue = new Queue(CALL_TIMER_QUEUE, { connection: newBullConnection('call-timers') });
    if (process.env.CALL_WORKER !== 'false') {
      this.worker = new Worker(
        CALL_TIMER_QUEUE,
        (job) => this.endCall(String(job.data.callId), 'time-cap', true),
        { connection: newBullConnection('call-timers:worker'), concurrency: 5, ...workerTuning() },
      );
      this.worker.on('failed', (job, err) => {
        // DLQ signal: a timer that never ran means a call can overrun its cap,
        // so this is alert-worthy (`increase(api_jobs_failed_total[10m]) > 0`).
        incCounter('api_jobs_failed_total', { queue: 'call-timers' });
        // eslint-disable-next-line no-console
        console.warn(`[calls] timer ${job?.id} failed: ${err.message}`);
      });
      // eslint-disable-next-line no-console
      console.log(`[calls] timer worker live (sfu=${this.provider ?? 'missing-keys'})`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Start a call: { groupId } (pro group call) or { inviteeId } (1:1). */
  async start(initiatorId: string, role: Role, input: { groupId?: string; inviteeId?: string }) {
    let type: '1:1' | 'group';
    let groupId: mongoose.Types.ObjectId | undefined;
    let inviteeId: string | null = null;

    if (input.groupId) {
      if (!canStartGroupCall(role)) {
        throw new HttpException(
          { statusCode: 429, error: 'Group calls are a Pro perk', feature: 'group_calls', proRequired: true },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const g = await this.groups.requireMember(initiatorId, input.groupId);
      if (g.member_count > MAX_GROUP_CALL_SIZE) {
        throw new HttpException(
          { statusCode: 400, error: `Group calls support up to ${MAX_GROUP_CALL_SIZE} participants` },
          HttpStatus.BAD_REQUEST,
        );
      }
      type = 'group';
      groupId = g._id;
    } else if (input.inviteeId) {
      if (input.inviteeId === initiatorId) {
        throw new HttpException({ statusCode: 400, error: 'Cannot call yourself' }, HttpStatus.BAD_REQUEST);
      }
      type = '1:1';
      inviteeId = input.inviteeId;
    } else {
      throw new HttpException({ statusCode: 400, error: 'groupId or inviteeId required' }, HttpStatus.BAD_REQUEST);
    }

    // Free tier needs remaining minutes to start (spec §6: 15 min cap).
    const remaining = (await this.entitlements.check(initiatorId, role, 'call_minutes')).remaining;
    const capMin = capMinutesFor(role, remaining === -1 ? Number.MAX_SAFE_INTEGER : remaining);
    if (capMin <= 0) {
      throw new HttpException(
        { statusCode: 429, error: 'Call minutes exhausted for today', feature: 'call_minutes', limit: 15 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const roomId = `call_${new mongoose.Types.ObjectId().toHexString()}`;
    const call = await this.calls.create({
      initiator_id: initiatorId,
      participant_ids: [initiatorId],
      all_participant_ids: [initiatorId],
      invitee_id: inviteeId,
      group_id: groupId,
      type,
      sfu_room_id: roomId,
      status: 'active',
    });

    const rtk = this.rtk();
    if (rtk) {
      try {
        const res = await fetch(`${this.rtkBase()}/meetings`, {
          method: 'POST',
          headers: this.rtkHeaders()!,
          body: JSON.stringify({ title: `ai-academy-${String(call._id)}` }),
        });
        const data = (await res.json()) as { success?: boolean; data?: { id?: string } };
        const meetingId = data?.data?.id;
        if (res.ok && meetingId) {
          call.sfu_room_id = meetingId;
          await call.save();
        } else {
          // eslint-disable-next-line no-console
          console.warn('[calls] rtk meeting create failed:', JSON.stringify(data).slice(0, 300));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[calls] rtk meeting create failed:', (err as Error).message);
      }
    }

    // Server-side hard stop (spec §5.4: duration caps enforced server-side).
    if (this.queue) {
      await this.queue.add(
        `end:${call._id}`,
        { callId: String(call._id) },
        { delay: capMin * 60000, attempts: 1, removeOnComplete: 50 },
      );
    }
    return { ...this.shape(call), capMinutes: capMin, sfu: this.live, provider: this.provider };
  }

  async join(userId: string, role: Role, id: string) {
    const call = await this.owned(userId, id);
    if (call.status !== 'active') {
      throw new HttpException({ statusCode: 410, error: 'Call has ended' }, HttpStatus.GONE);
    }
    if (call.type === 'group' && call.group_id) {
      await this.groups.requireMember(userId, String(call.group_id));
    } else if (call.type === '1:1' && userId !== call.initiator_id && userId !== call.invitee_id) {
      throw new HttpException({ statusCode: 403, error: 'Not invited to this call' }, HttpStatus.FORBIDDEN);
    }
    if (!call.participant_ids.includes(userId)) {
      call.participant_ids.push(userId);
    }
    if (!call.all_participant_ids.includes(userId)) {
      call.all_participant_ids.push(userId);
    }
    await call.save();
    return { call: this.shape(call), token: await this.mint(userId, role, call), provider: this.provider };
  }

  /** Short-lived join token (also powers room-page reconnects). */
  token(userId: string, role: Role, id: string) {
    return this.owned(userId, id).then(async (call) => {
      if (call.status !== 'active') {
        throw new HttpException({ statusCode: 410, error: 'Call has ended' }, HttpStatus.GONE);
      }
      return {
        token: await this.mint(userId, role, call),
        room: call.sfu_room_id,
        provider: this.provider,
      };
    });
  }

  private async mint(userId: string, role: Role, call: CallDocument): Promise<string | null> {
    return this.mintRtk(userId, role, call);
  }

  private async mintRtk(userId: string, role: Role, call: CallDocument): Promise<string | null> {
    const rtk = this.rtk();
    if (!rtk) return null; // web shows the setup notice
    const isHost = userId === call.initiator_id || role === 'admin';
    try {
      const res = await fetch(`${this.rtkBase()}/meetings/${call.sfu_room_id}/participants`, {
        method: 'POST',
        headers: this.rtkHeaders()!,
        body: JSON.stringify({
          custom_participant_id: userId,
          preset_name: isHost ? rtk.presetHost : rtk.preset,
          name: userId.slice(0, 60),
        }),
      });
      const data = (await res.json()) as { success?: boolean; data?: { token?: string } };
      if (res.ok && data?.data?.token) return data.data.token;
      // eslint-disable-next-line no-console
      console.warn('[calls] rtk add-participant failed:', JSON.stringify(data).slice(0, 300));
      return null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[calls] rtk add-participant failed:', (err as Error).message);
      return null;
    }
  }

  async leave(userId: string, id: string) {
    const call = await this.owned(userId, id);
    call.participant_ids = call.participant_ids.filter((p) => p !== userId);
    await call.save();
    if (call.participant_ids.length === 0) {
      await this.endCall(String(call._id), 'empty', false);
    }
    return { left: true };
  }

  async end(userId: string, role: Role, id: string) {
    const call = await this.owned(userId, id);
    const isMod = call.initiator_id === userId || role === 'admin';
    if (!isMod && call.group_id) {
      const g = await this.groups.requireMember(userId, String(call.group_id));
      if (g.owner_id !== userId) {
        throw new HttpException({ statusCode: 403, error: 'Only the initiator or group owner can end' }, HttpStatus.FORBIDDEN);
      }
    } else if (!isMod) {
      throw new HttpException({ statusCode: 403, error: 'Only the initiator can end' }, HttpStatus.FORBIDDEN);
    }
    await this.endCall(String(call._id), 'manual', false);
    return { ended: true };
  }

  /** Best-effort screen-share flag from the client (analytics + record). */
  async screenShare(userId: string, id: string) {
    const call = await this.owned(userId, id);
    call.screen_share_used = true;
    await call.save();
    return { noted: true };
  }

  async report(userId: string, id: string, reason: string) {
    const call = await this.owned(userId, id);
    call.flagged = true;
    call.flag_reason = reason.slice(0, 300);
    await call.save();
    return { reported: true };
  }

  /** My calls: active first, then recent history (visible even after leaving). */
  async mine(userId: string, groupId?: string, limit = 20) {
    const filter: Record<string, unknown> = { all_participant_ids: userId };
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) filter.group_id = new mongoose.Types.ObjectId(groupId);
    const rows = await this.calls
      .find(filter)
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    const actives = rows.filter((r) => r.status === 'active').map((r) => this.shape(r));
    return { active: actives, items: rows.map((r) => this.shape(r)) };
  }

  async flaggedForAdmin(limit = 50) {
    const rows = await this.calls
      .find({ flagged: true })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    return { items: rows.map((r) => this.shape(r)) };
  }

  /** Finalize: duration, per-minute billing for every participant, SFU cleanup. */
  async endCall(id: string, reason: string, fromTimer: boolean) {
    const call = await this.calls.findById(id).exec();
    if (!call || call.status !== 'active') return { skipped: true };
    const started = call.started_at ?? new Date();
    const sec = Math.max(0, Math.round((Date.now() - started.getTime()) / 1000));
    const minutes = minutesForDuration(sec);
    const missed = call.participant_ids.length <= 1 && sec < 60;
    call.status = missed ? 'missed' : 'completed';
    call.ended_at = new Date();
    call.duration_sec = sec;
    await call.save();

    // Bill every participant their minutes (spec §3 quota_usage.call_minutes_used).
    for (const pid of new Set([call.initiator_id, ...call.participant_ids])) {
      try {
        // Retroactive accounting: minutes were already spent, so record the
        // real usage even beyond the limit (never rolled back, never 429s).
        // No role lookup needed — accounting is role-independent.
        await this.entitlements.record(pid, 'call_minutes', minutes);
      } catch { /* best effort per participant */ }
    }

    const rtk = this.rtk();
    if (rtk) {
      try {
        await fetch(`${this.rtkBase()}/meetings/${call.sfu_room_id}/active-session/kick-all`, {
          method: 'POST',
          headers: this.rtkHeaders()!,
        }).catch(() => undefined);
        await fetch(`${this.rtkBase()}/meetings/${call.sfu_room_id}`, {
          method: 'PATCH',
          headers: this.rtkHeaders()!,
          body: JSON.stringify({ status: 'INACTIVE' }),
        }).catch(() => undefined);
      } catch { /* already closed or never created */ }
    }
    // eslint-disable-next-line no-console
    console.log(`[calls] ended ${id} (${reason}): ${sec}s billed ${minutes}min`);
    return { ended: true, reason, fromTimer, minutes };
  }

  private async owned(userId: string, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const call = await this.calls.findById(id).exec();
    if (!call) throw new HttpException({ statusCode: 404, error: 'Call not found' }, HttpStatus.NOT_FOUND);
    const allowed =
      call.participant_ids.includes(userId) ||
      userId === call.initiator_id ||
      userId === call.invitee_id;
    if (!allowed) {
      // Group members may discover/join active group calls via the group page.
      if (call.type === 'group' && call.group_id) {
        await this.groups.requireMember(userId, String(call.group_id));
      } else {
        throw new HttpException({ statusCode: 403, error: 'Not part of this call' }, HttpStatus.FORBIDDEN);
      }
    }
    return call;
  }

  async remove(userId: string, id: string) {
    const call = await this.owned(userId, id);
    if (call.initiator_id === userId) {
      await this.calls.deleteOne({ _id: id }).exec();
    } else {
      call.all_participant_ids = call.all_participant_ids.filter((p) => p !== userId);
      call.participant_ids = call.participant_ids.filter((p) => p !== userId);
      if (call.all_participant_ids.length === 0) {
        await this.calls.deleteOne({ _id: id }).exec();
      } else {
        await call.save();
      }
    }
    return { deleted: true };
  }

  async clearHistory(userId: string) {
    await this.calls.deleteMany({ initiator_id: userId, status: { $ne: 'active' } }).exec();
    await this.calls.updateMany(
      { all_participant_ids: userId, status: { $ne: 'active' } },
      { $pull: { all_participant_ids: userId, participant_ids: userId } },
    ).exec();
    await this.calls.deleteMany({ status: { $ne: 'active' }, all_participant_ids: { $size: 0 } }).exec();
    return { cleared: true };
  }

  private shape(c: CallDocument | Record<string, unknown>) {
    const o = (c as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (c as Record<string, unknown>);
    return {
      id: String(o._id),
      initiator_id: o.initiator_id,
      invitee_id: o.invitee_id,
      group_id: o.group_id ? String(o.group_id) : null,
      type: o.type,
      status: o.status,
      participant_ids: o.participant_ids,
      duration_sec: o.duration_sec,
      screen_share_used: o.screen_share_used,
      flagged: o.flagged,
      started_at: o.started_at,
      ended_at: o.ended_at,
    };
  }
}
