import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model } from 'mongoose';
import { Message, MessageDocument } from '../messages/message.schema.js';
import { Group, GroupDocument } from '../groups/group.schema.js';
import { envInt } from '../config.js';

/**
 * Retention purges (docs/COMPLIANCE.md §2).
 *
 * What this covers:
 * - soft-deleted groups (`groups.deleted = true`) are hard-deleted after a
 *   grace window, along with their messages;
 * - soft-deleted messages (`messages.deleted = true`, e.g. moderation
 *   removals) are hard-deleted after the same grace window.
 *
 * What this deliberately does NOT do: hard-delete visible messages older than
 * the free-tier 30-day read window (`messages/policy.ts`). Message rows do not
 * record the sender's role at send time, and `pro`/`admin` retention is
 * infinite — a blind `created_at` purge would destroy Pro history. That job
 * needs sender-tier tracking first and stays a tracked gap.
 *
 * Purges are admin-triggered (audited) rather than scheduled so operators can
 * dry-run via `status()` and run them from the admin UI / runbook. Bounds
 * (`limit`) keep each call short; repeat until `truncated` is false.
 */
@Injectable()
export class RetentionService {
  constructor(
    @InjectModel(Message.name) private readonly messages: Model<MessageDocument>,
    @InjectModel(Group.name) private readonly groups: Model<GroupDocument>,
  ) {}

  /** Grace window for soft-deleted rows (days). Override with env. */
  graceDays(): number {
    return envInt('RETENTION_SOFT_DELETE_GRACE_DAYS', 30, { min: 1 });
  }

  private cutoff(days: number, now = Date.now()): Date {
    return new Date(now - days * 86400000);
  }

  private clamp(n: number | undefined, fallback: number, min: number, max: number): number {
    if (!Number.isFinite(n as number)) return fallback;
    return Math.min(Math.max(Math.trunc(n as number), min), max);
  }

  /** Dry-run counts of rows eligible for purge right now. */
  async status(now = Date.now()) {
    const days = this.graceDays();
    const cutoff = this.cutoff(days, now);
    const match = { updated_at: { $lt: cutoff } };
    const [softDeletedMessages, softDeletedGroups] = await Promise.all([
      this.messages.countDocuments({ deleted: true, ...match }).exec(),
      this.groups.countDocuments({ deleted: true, ...match }).exec(),
    ]);
    return {
      graceDays: days,
      cutoff: cutoff.toISOString(),
      eligible: { softDeletedMessages, softDeletedGroups },
    };
  }

  /** Hard-delete soft-deleted messages older than the grace window. */
  async purgeDeletedMessages(olderThanDays?: number, limit?: number, now = Date.now()) {
    const days = olderThanDays ?? this.graceDays();
    const cutoff = this.cutoff(days, now);
    const lim = this.clamp(limit, 1000, 1, 10000);
    const rows = await this.messages
      .find({ deleted: true, updated_at: { $lt: cutoff } })
      .select('_id')
      .limit(lim)
      .lean()
      .exec();
    const ids = rows.map((r) => (r as unknown as { _id: mongoose.Types.ObjectId })._id);
    if (ids.length === 0) {
      return { deleted: 0, cutoff: cutoff.toISOString(), truncated: false };
    }
    const res = await this.messages.deleteMany({ _id: { $in: ids } }).exec();
    return {
      deleted: res.deletedCount ?? 0,
      cutoff: cutoff.toISOString(),
      truncated: ids.length === lim,
    };
  }

  /**
   * Hard-delete soft-deleted groups older than the grace window, plus every
   * message in those groups (visible or not — the group is gone).
   */
  async purgeDeletedGroups(olderThanDays?: number, limit?: number, now = Date.now()) {
    const days = olderThanDays ?? this.graceDays();
    const cutoff = this.cutoff(days, now);
    const lim = this.clamp(limit, 100, 1, 500);
    const rows = await this.groups
      .find({ deleted: true, updated_at: { $lt: cutoff } })
      .select('_id')
      .limit(lim)
      .lean()
      .exec();
    const ids = rows.map((r) => (r as unknown as { _id: mongoose.Types.ObjectId })._id);
    if (ids.length === 0) {
      return { groups: 0, messages: 0, cutoff: cutoff.toISOString(), truncated: false };
    }
    const [msgRes, grpRes] = await Promise.all([
      this.messages.deleteMany({ group_id: { $in: ids } }).exec(),
      this.groups.deleteMany({ _id: { $in: ids } }).exec(),
    ]);
    return {
      groups: grpRes.deletedCount ?? 0,
      messages: msgRes.deletedCount ?? 0,
      cutoff: cutoff.toISOString(),
      truncated: ids.length === lim,
    };
  }
}
