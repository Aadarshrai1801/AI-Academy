import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import type { Redis } from 'ioredis';
import Ably from 'ably';
import { Message, MessageDocument } from './message.schema.js';
import { GroupsService } from '../groups/groups.service.js';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { Role } from '../common/entitlements.service.js';
import { SENDS_PER_MINUTE, currentMinute, retentionCutoff, throttleKey } from './policy.js';

export interface SendInput {
  type?: 'text' | 'question_share';
  content: string;
  questionId?: string;
}

const channelFor = (groupId: string) => `group:${groupId}`;

/**
 * Group chat (spec §2.4): persist-first, then fan out over Ably.
 * Without ABLY_API_KEY the API still persists + serves history and the web
 * client polls — same data shape, no live push (see /realtime/token).
 */
@Injectable()
export class MessagesService {
  private ably: Ably.Rest | null = null;

  constructor(
    @InjectModel(Message.name) private readonly messages: Model<MessageDocument>,
    private readonly groups: GroupsService,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
  ) {
    if (process.env.ABLY_API_KEY) {
      this.ably = new Ably.Rest(process.env.ABLY_API_KEY);
    }
  }

  get live() {
    return this.ably !== null;
  }

  async send(userId: string, role: Role, groupId: string, input: SendInput) {
    await this.groups.requireMember(userId, groupId);
    await this.throttle(userId, role);

    const type = input.type ?? 'text';
    if (!input.content.trim() || input.content.length > 4000) {
      throw new HttpException({ statusCode: 400, error: 'content must be 1..4000 chars' }, HttpStatus.BAD_REQUEST);
    }
    if (type === 'question_share' && input.questionId && !mongoose.Types.ObjectId.isValid(input.questionId)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid questionId' }, HttpStatus.BAD_REQUEST);
    }

    const m = await this.messages.create({
      group_id: new mongoose.Types.ObjectId(groupId),
      sender_id: userId,
      type,
      content: input.content.trim(),
      question_id: input.questionId ? new mongoose.Types.ObjectId(input.questionId) : undefined,
      read_by: [userId],
    });
    const dto = this.shape(m);
    await this.publish(groupId, 'message', dto);
    return dto;
  }

  /** Cursor history: ?before=<id>&limit= (older), or ?since=<ISO> (polling catch-up). */
  async history(userId: string, role: Role, groupId: string, opts: { before?: string; since?: string; limit?: number }) {
    await this.groups.requireMember(userId, groupId);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const filter: Record<string, unknown> = {
      group_id: new mongoose.Types.ObjectId(groupId),
      deleted: false,
    };
    const cutoff = retentionCutoff(role);
    if (cutoff) filter.created_at = { $gte: cutoff };
    if (opts.before && mongoose.Types.ObjectId.isValid(opts.before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(opts.before) };
    }
    if (opts.since) {
      const d = new Date(opts.since);
      if (!Number.isNaN(d.getTime())) {
        const prev = (filter.created_at as Record<string, unknown> | undefined) ?? {};
        filter.created_at = { ...prev, $gt: d };
      }
    }
    const rows = await this.messages.find(filter).sort({ _id: -1 }).limit(limit).lean().exec();
    return { items: rows.reverse().map((r) => this.shape(r)) };
  }

  async react(userId: string, groupId: string, id: string, emoji: string) {
    await this.groups.requireMember(userId, groupId);
    if (!/^\p{Extended_Pictographic}$/u.test(emoji) && emoji.length > 12) {
      throw new HttpException({ statusCode: 400, error: 'Invalid reaction' }, HttpStatus.BAD_REQUEST);
    }
    const m = await this.owned(userId, groupId, id, false);
    const current = m.reactions?.get(emoji) ?? [];
    if (current.includes(userId)) {
      m.reactions.set(emoji, current.filter((u) => u !== userId));
      if (m.reactions.get(emoji)!.length === 0) m.reactions.delete(emoji);
    } else {
      m.reactions.set(emoji, [...current, userId]);
    }
    m.markModified('reactions');
    await m.save();
    const dto = this.shape(m);
    await this.publish(groupId, 'message', dto);
    return dto;
  }

  async markRead(userId: string, groupId: string, id: string) {
    await this.groups.requireMember(userId, groupId);
    const { groupId: gid, id: mid } = this.oids(groupId, id);
    await this.messages.updateOne({ _id: mid, group_id: gid }, { $addToSet: { read_by: userId } }).exec();
    return { read: true };
  }

  async edit(userId: string, groupId: string, id: string, content: string) {
    const m = await this.owned(userId, groupId, id, true);
    if (!content.trim() || content.length > 4000) {
      throw new HttpException({ statusCode: 400, error: 'content must be 1..4000 chars' }, HttpStatus.BAD_REQUEST);
    }
    m.content = content.trim();
    m.edited_at = new Date();
    await m.save();
    const dto = this.shape(m);
    await this.publish(groupId, 'message', dto);
    return dto;
  }

  async remove(userId: string, role: Role, groupId: string, id: string) {
    // Owners/admins may remove any message (spec §1 moderation); members only their own.
    const { groupId: gid, id: mid } = this.oids(groupId, id);
    const m = await this.messages.findOne({ _id: mid, group_id: gid, deleted: false }).exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    const g = await this.groups.requireMember(userId, groupId);
    const isMod = m.sender_id === userId || g.owner_id === userId || role === 'admin';
    if (!isMod) throw new HttpException({ statusCode: 403, error: 'Cannot delete this message' }, HttpStatus.FORBIDDEN);
    m.deleted = true;
    await m.save();
    await this.publish(groupId, 'message-deleted', { id: String(m._id) });
    return { deleted: true };
  }

  async report(userId: string, groupId: string, id: string, reason: string) {
    await this.groups.requireMember(userId, groupId);
    const { groupId: gid, id: mid } = this.oids(groupId, id);
    const m = await this.messages.findOne({ _id: mid, group_id: gid, deleted: false }).exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    m.flagged = true;
    m.flag_reason = reason.slice(0, 300);
    await m.save();
    return { reported: true };
  }

  async flaggedForAdmin(limit = 50) {
    const rows = await this.messages
      .find({ flagged: true, deleted: false })
      .sort({ _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();
    return { items: rows.map((r) => this.shape(r)) };
  }

  private async owned(userId: string, groupId: string, id: string, ownOnly: boolean) {
    await this.groups.requireMember(userId, groupId);
    const { groupId: gid, id: mid } = this.oids(groupId, id);
    const m = await this.messages.findOne({ _id: mid, group_id: gid, deleted: false }).exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    if (ownOnly && m.sender_id !== userId) {
      throw new HttpException({ statusCode: 403, error: 'Only the author can edit' }, HttpStatus.FORBIDDEN);
    }
    return m;
  }

  /** Explicit ObjectId conversion (never rely on query casting) + 400 on garbage ids. */
  private oids(groupId: string, id: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    return { groupId: new mongoose.Types.ObjectId(groupId), id: new mongoose.Types.ObjectId(id) };
  }

  private async throttle(userId: string, role: Role) {    const limit = SENDS_PER_MINUTE[role];
    if (limit === -1 || !this.redis) return;
    const key = throttleKey(userId, currentMinute());
    const used = await this.redis.incr(key);
    if (used === 1) await this.redis.expire(key, 120);
    if (used > limit) {
      throw new HttpException(
        { statusCode: 429, error: 'Message rate limit', limit, feature: 'chat_messages' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async publish(groupId: string, event: string, data: unknown) {
    if (!this.ably) return;
    try {
      await this.ably.channels.get(channelFor(groupId)).publish(event, data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[chat] ably publish failed (message persisted):', (err as Error).message);
    }
  }

  shape(m: MessageDocument | Record<string, unknown>) {
    const o = (m as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (m as Record<string, unknown>);
    const reactions: Record<string, string[]> = {};
    const raw = o.reactions as Map<string, string[]> | Record<string, string[]> | undefined;
    if (raw instanceof Map) raw.forEach((v, k) => (reactions[k] = v));
    else if (raw) Object.assign(reactions, raw);
    return {
      id: String(o._id),
      group_id: String((o.group_id as mongoose.Types.ObjectId)?.toString?.() ?? o.group_id),
      sender_id: o.sender_id,
      type: o.type,
      content: o.content,
      question_id: o.question_id ? String(o.question_id) : undefined,
      media_url: o.media_url,
      edited_at: o.edited_at,
      read_by: o.read_by,
      reactions,
      flagged: o.flagged,
      created_at: (o.created_at as Date)?.toISOString?.() ?? o.created_at,
    };
  }
}
