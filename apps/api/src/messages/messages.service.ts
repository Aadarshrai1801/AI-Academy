import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import type { Redis } from 'ioredis';
import Ably from 'ably';
import { Message, MessageDocument } from './message.schema.js';
import { GroupsService } from '../groups/groups.service.js';
import { UsersService } from '../users/users.service.js';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { Role } from '../common/entitlements.service.js';
import { SENDS_PER_MINUTE, currentMinute, retentionCutoff, throttleKey } from './policy.js';

export interface SendInput {
  type?: 'text' | 'question_share' | 'study_prompt';
  content: string;
  questionId?: string;
}

const channelFor = (groupId: string) => `group:${groupId}`;

/**
 * Group chat & personalized 1:1 direct messages: persist-first, then fan out over Ably.
 * Without ABLY_API_KEY the API still persists + serves history and the web
 * client polls — same data shape, no live push (see /realtime/token).
 */
@Injectable()
export class MessagesService {
  private ably: Ably.Rest | null = null;

  static dmConversationId(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  constructor(
    @InjectModel(Message.name) private readonly messages: Model<MessageDocument>,
    private readonly groups: GroupsService,
    private readonly users: UsersService,
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

  /**
   * Study-mode feed: post a recently-missed question to every study group the
   * member belongs to so the cohort can discuss it in the existing chat
   * transport (no new channel). Deduped per (group, member, question) for 72h;
   * callers treat this as best-effort — a chat failure never breaks grading.
   */
  async publishMissedQuestion(
    userId: string,
    input: { questionId: string; topic: string; difficulty: string; prompt: string },
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(input.questionId)) return 0;
    const content = (input.prompt ?? '').trim().slice(0, 4000);
    if (!content) return 0;
    const groupIds = await this.groups.studyGroupIdsFor(userId);
    let posted = 0;
    for (const groupId of groupIds) {
      const since = new Date(Date.now() - 72 * 3600 * 1000);
      const existing = await this.messages
        .findOne({
          group_id: new mongoose.Types.ObjectId(groupId),
          sender_id: userId,
          type: 'study_prompt',
          question_id: new mongoose.Types.ObjectId(input.questionId),
          created_at: { $gte: since },
        })
        .select('_id')
        .lean()
        .exec();
      if (existing) continue;
      const m = await this.messages.create({
        group_id: new mongoose.Types.ObjectId(groupId),
        sender_id: userId,
        type: 'study_prompt',
        content,
        question_id: new mongoose.Types.ObjectId(input.questionId),
        read_by: [userId],
      });
      await this.publish(groupId, 'message', this.shape(m));
      posted += 1;
    }
    return posted;
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
    return this.publishChannel(channelFor(groupId), event, data);
  }

  private async publishChannel(channel: string, event: string, data: unknown) {
    if (!this.ably) return;
    try {
      await this.ably.channels.get(channel).publish(event, data);
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
      group_id: o.group_id ? String((o.group_id as mongoose.Types.ObjectId)?.toString?.() ?? o.group_id) : undefined,
      conversation_id: o.conversation_id as string | undefined,
      sender_id: o.sender_id as string,
      recipient_id: o.recipient_id as string | undefined,
      type: o.type,
      content: o.content,
      question_id: o.question_id ? String(o.question_id) : undefined,
      media_url: o.media_url,
      edited_at: o.edited_at,
      read_by: (o.read_by as string[]) ?? [],
      reactions,
      flagged: o.flagged,
      created_at: (o.created_at as Date)?.toISOString?.() ?? o.created_at,
    };
  }

  // ── 1:1 Personalized Direct Messages ──────────────────────────────────────

  async sendDirect(userId: string, role: Role, partnerId: string, input: SendInput) {
    if (!partnerId || partnerId === userId) {
      throw new HttpException({ statusCode: 400, error: 'Cannot direct message yourself' }, HttpStatus.BAD_REQUEST);
    }
    await this.throttle(userId, role);

    const type = input.type ?? 'text';
    if (!input.content.trim() || input.content.length > 4000) {
      throw new HttpException({ statusCode: 400, error: 'content must be 1..4000 chars' }, HttpStatus.BAD_REQUEST);
    }
    if (type === 'question_share' && input.questionId && !mongoose.Types.ObjectId.isValid(input.questionId)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid questionId' }, HttpStatus.BAD_REQUEST);
    }

    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const m = await this.messages.create({
      conversation_id: conversationId,
      sender_id: userId,
      recipient_id: partnerId,
      type,
      content: input.content.trim(),
      question_id: input.questionId ? new mongoose.Types.ObjectId(input.questionId) : undefined,
      read_by: [userId],
    });
    const dto = this.shape(m);
    await this.publishChannel(`dm:${conversationId}`, 'message', dto);
    await this.publishChannel(`user:${partnerId}`, 'dm-notification', {
      conversation_id: conversationId,
      sender_id: userId,
      content: input.content.trim(),
      type,
    });
    return dto;
  }

  async directHistory(
    userId: string,
    role: Role,
    partnerId: string,
    opts: { before?: string; since?: string; limit?: number },
  ) {
    if (!partnerId || partnerId === userId) {
      throw new HttpException({ statusCode: 400, error: 'Invalid partnerId' }, HttpStatus.BAD_REQUEST);
    }
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const filter: Record<string, unknown> = {
      conversation_id: conversationId,
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

    const [rows, partnerUser] = await Promise.all([
      this.messages.find(filter).sort({ _id: -1 }).limit(limit).lean().exec(),
      this.users.findByClerkId(partnerId),
    ]);

    // Mark partner's messages as read by this user
    await this.messages
      .updateMany(
        { conversation_id: conversationId, recipient_id: userId, read_by: { $ne: userId } },
        { $addToSet: { read_by: userId } },
      )
      .exec();

    return {
      items: rows.reverse().map((r) => this.shape(r)),
      partner: {
        id: partnerId,
        username: partnerUser?.username ?? null,
        points_total: partnerUser?.points_total ?? 0,
        current_streak: partnerUser?.current_streak ?? 0,
        longest_streak: partnerUser?.longest_streak ?? 0,
        role: partnerUser?.role ?? 'free',
        avatar_url: partnerUser?.avatar_url,
      },
    };
  }

  async listConversations(userId: string) {
    const msgs = await this.messages
      .find({
        conversation_id: { $exists: true, $ne: null },
        $or: [{ sender_id: userId }, { recipient_id: userId }],
        deleted: false,
      })
      .sort({ _id: -1 })
      .limit(1000)
      .lean()
      .exec();

    const convoMap = new Map<
      string,
      { latest: Record<string, unknown>; unreadCount: number; partnerId: string }
    >();

    for (const m of msgs) {
      const raw = m as unknown as Record<string, unknown>;
      const cid = raw.conversation_id as string;
      const sid = raw.sender_id as string;
      const rid = raw.recipient_id as string;
      const partnerId = sid === userId ? rid : sid;
      const readBy = (raw.read_by as string[]) ?? [];
      const isUnread = rid === userId && !readBy.includes(userId);

      if (!convoMap.has(cid)) {
        convoMap.set(cid, {
          latest: raw,
          unreadCount: isUnread ? 1 : 0,
          partnerId,
        });
      } else {
        const existing = convoMap.get(cid)!;
        if (isUnread) existing.unreadCount += 1;
      }
    }

    const partnerIds = [...new Set([...convoMap.values()].map((c) => c.partnerId).filter(Boolean))];
    const partnerProfiles = await this.users.findManyByClerkIds(partnerIds);
    const profileMap = new Map(partnerProfiles.map((p) => [p.clerkId, p]));

    const conversations = [...convoMap.entries()].map(([cid, data]) => {
      const profile = profileMap.get(data.partnerId);
      const latest = data.latest;
      return {
        conversationId: cid,
        partner: {
          id: data.partnerId,
          username: profile?.username ?? null,
          points_total: profile?.points_total ?? 0,
          current_streak: profile?.current_streak ?? 0,
          role: profile?.role ?? 'free',
          avatar_url: profile?.avatar_url,
        },
        lastMessage: {
          id: String(latest._id),
          sender_id: latest.sender_id as string,
          content: latest.content as string,
          type: latest.type as string,
          created_at: (latest.created_at as Date)?.toISOString?.() ?? String(latest.created_at),
          read: (latest.read_by as string[])?.includes(userId) ?? false,
        },
        unreadCount: data.unreadCount,
        updated_at: (latest.created_at as Date)?.toISOString?.() ?? String(latest.created_at),
      };
    });

    return { conversations };
  }

  async markDirectRead(userId: string, partnerId: string, id?: string) {
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      await this.messages
        .updateOne(
          { _id: new mongoose.Types.ObjectId(id), conversation_id: conversationId },
          { $addToSet: { read_by: userId } },
        )
        .exec();
    } else {
      await this.messages
        .updateMany(
          { conversation_id: conversationId, recipient_id: userId, read_by: { $ne: userId } },
          { $addToSet: { read_by: userId } },
        )
        .exec();
    }
    return { read: true };
  }

  async reactDirect(userId: string, partnerId: string, id: string, emoji: string) {
    if (!/^\p{Extended_Pictographic}$/u.test(emoji) && emoji.length > 12) {
      throw new HttpException({ statusCode: 400, error: 'Invalid reaction' }, HttpStatus.BAD_REQUEST);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const m = await this.messages
      .findOne({ _id: new mongoose.Types.ObjectId(id), conversation_id: conversationId, deleted: false })
      .exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);

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
    await this.publishChannel(`dm:${conversationId}`, 'message', dto);
    return dto;
  }

  async editDirect(userId: string, partnerId: string, id: string, content: string) {
    if (!content.trim() || content.length > 4000) {
      throw new HttpException({ statusCode: 400, error: 'content must be 1..4000 chars' }, HttpStatus.BAD_REQUEST);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const m = await this.messages
      .findOne({ _id: new mongoose.Types.ObjectId(id), conversation_id: conversationId, deleted: false })
      .exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    if (m.sender_id !== userId) {
      throw new HttpException({ statusCode: 403, error: 'Only the author can edit' }, HttpStatus.FORBIDDEN);
    }
    m.content = content.trim();
    m.edited_at = new Date();
    await m.save();
    const dto = this.shape(m);
    await this.publishChannel(`dm:${conversationId}`, 'message', dto);
    return dto;
  }

  async removeDirect(userId: string, role: Role, partnerId: string, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const m = await this.messages
      .findOne({ _id: new mongoose.Types.ObjectId(id), conversation_id: conversationId, deleted: false })
      .exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    if (m.sender_id !== userId && role !== 'admin') {
      throw new HttpException({ statusCode: 403, error: 'Cannot delete this message' }, HttpStatus.FORBIDDEN);
    }
    m.deleted = true;
    await m.save();
    await this.publishChannel(`dm:${conversationId}`, 'message-deleted', { id: String(m._id) });
    return { deleted: true };
  }

  async reportDirect(userId: string, partnerId: string, id: string, reason: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpException({ statusCode: 400, error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const conversationId = MessagesService.dmConversationId(userId, partnerId);
    const m = await this.messages
      .findOne({ _id: new mongoose.Types.ObjectId(id), conversation_id: conversationId, deleted: false })
      .exec();
    if (!m) throw new HttpException({ statusCode: 404, error: 'Message not found' }, HttpStatus.NOT_FOUND);
    m.flagged = true;
    m.flag_reason = reason.slice(0, 300);
    await m.save();
    return { reported: true };
  }

  async getPeers(userId: string) {
    const myGroups = await this.groups.mine(userId);
    const peerToGroup = new Map<string, string>();
    for (const g of myGroups.items) {
      for (const mid of (g.member_ids as string[] | undefined) ?? []) {
        if (mid !== userId && !peerToGroup.has(mid)) {
          peerToGroup.set(mid, String(g.name));
        }
      }
    }
    const peerIds = [...peerToGroup.keys()];
    const profiles = await this.users.findManyByClerkIds(peerIds);
    const peers = profiles.map((p) => ({
      id: p.clerkId,
      username: p.username,
      points_total: p.points_total,
      current_streak: p.current_streak,
      role: p.role,
      avatar_url: p.avatar_url,
      viaGroup: peerToGroup.get(p.clerkId),
    }));

    if (peers.length < 8) {
      const activeUsers = await this.users.searchUsers('', 12);
      const existing = new Set(peers.map((p) => p.id).concat(userId));
      for (const u of activeUsers) {
        if (!existing.has(u.clerkId)) {
          peers.push({
            id: u.clerkId,
            username: u.username,
            points_total: u.points_total,
            current_streak: u.current_streak,
            role: u.role,
            avatar_url: u.avatar_url,
            viaGroup: 'AI Academy Community',
          });
          existing.add(u.clerkId);
        }
      }
    }

    return { peers: peers.slice(0, 20) };
  }
}
