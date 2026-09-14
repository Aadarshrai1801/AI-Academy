import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Group, GroupDocument } from './group.schema.js';
import { generateInviteCode, inviteExpiry, isInviteValid } from './invites.js';
import { Role } from '../common/entitlements.service.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';

const OWN_LIMIT: Record<Role, number> = { free: 1, pro: -1, admin: -1 };
const MEMBER_CAP: Record<Role, number> = { free: 10, pro: 250, admin: 10000 };

/**
 * Groups (spec §2.4): create with tier caps, rotatable expiring invites,
 * join/leave/kick, soft delete. Member lookups are id-scoped; usernames
 * resolve on the client via Clerk.
 */
@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groups: Model<GroupDocument>,
    private readonly leaderboard: LeaderboardService,
  ) {}

  private visible() {
    return { deleted: false };
  }

  async create(ownerId: string, role: Role, input: { name: string; privacy?: 'invite_only' | 'public' }) {
    const owned = await this.groups.countDocuments({ ...this.visible(), owner_id: ownerId }).exec();
    const limit = OWN_LIMIT[role];
    if (limit !== -1 && owned >= limit) {
      throw new HttpException(
        { statusCode: 429, error: 'Group creation limit reached', limit, feature: 'groups_owned' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const g = await this.groups.create({
      name: input.name,
      privacy: input.privacy ?? 'invite_only',
      owner_id: ownerId,
      member_ids: [ownerId],
      member_count: 1,
      max_members: MEMBER_CAP[role],
      invite_code: generateInviteCode(),
      invite_code_expires_at: inviteExpiry(),
    });
    return this.shape(g);
  }

  async mine(userId: string) {
    const rows = await this.groups.find({ ...this.visible(), member_ids: userId }).sort({ updated_at: -1 }).lean().exec();
    return { items: rows.map((g) => this.shape(g)) };
  }

  async get(userId: string, id: string) {
    const g = await this.requireMember(userId, id);
    return this.shape(g);
  }

  async rotateInvite(ownerId: string, id: string) {
    const g = await this.requireOwner(ownerId, id);
    g.invite_code = generateInviteCode();
    g.invite_code_expires_at = inviteExpiry();
    await g.save();
    return { invite_code: g.invite_code, invite_code_expires_at: g.invite_code_expires_at };
  }

  async join(userId: string, code: string) {
    const g = await this.groups.findOne({ ...this.visible(), invite_code: code }).exec();
    if (!g) throw new HttpException({ statusCode: 404, error: 'Invalid invite code' }, HttpStatus.NOT_FOUND);
    if (!isInviteValid(g.invite_code_expires_at)) {
      throw new HttpException({ statusCode: 410, error: 'Invite link expired' }, HttpStatus.GONE);
    }
    if (g.member_ids.includes(userId)) return this.shape(g);
    if (g.member_count >= g.max_members) {
      throw new HttpException({ statusCode: 429, error: 'Group is full', limit: g.max_members }, HttpStatus.TOO_MANY_REQUESTS);
    }
    g.member_ids.push(userId);
    g.member_count = g.member_ids.length;
    await g.save();
    return this.shape(g);
  }

  async leave(userId: string, id: string) {
    const g = await this.requireMember(userId, id);
    if (g.owner_id === userId) {
      throw new HttpException({ statusCode: 400, error: 'Owner cannot leave; delete the group instead' }, HttpStatus.BAD_REQUEST);
    }
    g.member_ids = g.member_ids.filter((m) => m !== userId);
    g.member_count = g.member_ids.length;
    await g.save();
    return { left: true };
  }

  async kick(ownerId: string, id: string, targetId: string) {
    const g = await this.requireOwner(ownerId, id);
    if (targetId === g.owner_id) {
      throw new HttpException({ statusCode: 400, error: 'Cannot remove the owner' }, HttpStatus.BAD_REQUEST);
    }
    g.member_ids = g.member_ids.filter((m) => m !== targetId);
    g.member_count = g.member_ids.length;
    await g.save();
    return { removed: targetId };
  }

  async remove(ownerId: string, id: string) {
    const g = await this.requireOwner(ownerId, id);
    g.deleted = true; // soft delete — message retention policy applies (spec §2.4)
    await g.save();
    return { deleted: true };
  }

  /** Member-only daily board for group challenges (spec §2.4 gamification). */
  async memberBoard(userId: string, id: string, day = new Date().toISOString().slice(0, 10)) {
    const g = await this.requireMember(userId, id);
    const scores = await Promise.all(
      g.member_ids.map(async (m) => ({ userId: m, score: await this.leaderboard.scoreOf(m, day) })),
    );
    const entries = scores
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ rank: i + 1, userId: s.userId, score: s.score }));
    return { day, entries };
  }

  async requireMember(userId: string, id: string) {
    const g = await this.groups.findOne({ ...this.visible(), _id: id }).exec();
    if (!g) throw new HttpException({ statusCode: 404, error: 'Group not found' }, HttpStatus.NOT_FOUND);
    if (!g.member_ids.includes(userId)) {
      throw new HttpException({ statusCode: 403, error: 'Not a member' }, HttpStatus.FORBIDDEN);
    }
    return g;
  }

  async requireOwner(userId: string, id: string) {
    const g = await this.requireMember(userId, id);
    if (g.owner_id !== userId) {
      throw new HttpException({ statusCode: 403, error: 'Owner only' }, HttpStatus.FORBIDDEN);
    }
    return g;
  }

  shape(g: GroupDocument | Record<string, unknown>) {
    const o = (g as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (g as Record<string, unknown>);
    return {
      id: String(o._id),
      name: o.name,
      owner_id: o.owner_id,
      privacy: o.privacy,
      member_count: o.member_count,
      max_members: o.max_members,
      invite_code: o.invite_code,
      invite_code_expires_at: o.invite_code_expires_at,
      member_ids: o.member_ids,
    };
  }
}
