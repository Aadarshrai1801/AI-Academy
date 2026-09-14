import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import type { Redis } from 'ioredis';
import { promises as fs } from 'fs';
import { User, UserDocument } from './user.schema.js';
import { Subscription, SubscriptionDocument } from '../billing/subscription.schema.js';
import { Attempt, AttemptDocument } from '../attempts/attempt.schema.js';
import { Streak, StreakDocument } from '../streaks/streak.schema.js';
import { AiQuery, AiQueryDocument } from '../ai/ai-query.schema.js';
import { VideoJob, VideoJobDocument } from '../video/video-job.schema.js';
import { Call, CallDocument } from '../calls/call.schema.js';
import { Group, GroupDocument } from '../groups/group.schema.js';
import { Message, MessageDocument } from '../messages/message.schema.js';
import { LeaderboardSnapshot, SnapshotDocument } from '../leaderboard/leaderboard-snapshot.schema.js';
import { REDIS_CLIENT } from '../common/redis.module.js';
import { withTransaction } from '../common/mongo-transaction.js';
import { r2Configured, R2VideoStorage } from '../video/storage.provider.js';

/** Upper bound per collection for the data-portability export (safety valve). */
const EXPORT_LIMIT = 10_000;

/**
 * Phase 0: thin user service. Mongo is optional at runtime (see AppModule);
 * when the model is unavailable callers receive a dev stub instead of a crash.
 *
 * UsersService also owns GDPR-style self-service data portability + erasure
 * (right of access / right to be forgotten). Clerk remains the identity source
 * of truth — deleting the Clerk account itself is a separate dashboard/webhook
 * step documented in the README.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
    @InjectModel(Subscription.name) private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(Attempt.name) private readonly attempts: Model<AttemptDocument>,
    @InjectModel(Streak.name) private readonly streaks: Model<StreakDocument>,
    @InjectModel(AiQuery.name) private readonly queries: Model<AiQueryDocument>,
    @InjectModel(VideoJob.name) private readonly videos: Model<VideoJobDocument>,
    @InjectModel(Call.name) private readonly calls: Model<CallDocument>,
    @InjectModel(Group.name) private readonly groups: Model<GroupDocument>,
    @InjectModel(Message.name) private readonly messages: Model<MessageDocument>,
    @InjectModel(LeaderboardSnapshot.name) private readonly snapshots: Model<SnapshotDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(REDIS_CLIENT) @Optional() private readonly redis: Redis | null,
  ) {}

  async findByClerkId(clerkId: string): Promise<UserDocument | null> {
    return this.model.findOne({ clerkId }).exec();
  }

  async roleOf(clerkId: string): Promise<'free' | 'pro' | 'admin' | null> {
    const user = await this.model.findOne({ clerkId }).select('role status').lean().exec();
    if (!user || user.status !== 'active') return null;
    return user.role;
  }

  async setRole(clerkId: string, role: 'free' | 'pro' | 'admin') {
    return this.model.findOneAndUpdate({ clerkId }, { role }, { new: true }).exec();
  }

  async ensureUser(args: { clerkId: string; email: string; username: string }) {
    const existing = await this.findByClerkId(args.clerkId);
    if (existing) {
      existing.last_login_at = new Date();
      await existing.save();
      return existing;
    }
    return this.model.create({ ...args, role: 'free' });
  }

  async me(clerkId: string) {
    const user = await this.findByClerkId(clerkId);
    if (!user) return { clerkId, role: 'free', onboarded: false };
    return {
      clerkId: user.clerkId,
      email: user.email,
      username: user.username,
      role: user.role,
      points_total: user.points_total,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      onboarded: true,
    };
  }

  /**
   * Data portability (GDPR art. 15/20): everything we store about the caller in
   * one JSON document. Collections are capped at EXPORT_LIMIT and report
   * `truncated` when capped, so the response stays bounded.
   */
  async exportData(clerkId: string) {
    const user = await this.model.findOne({ clerkId }).lean().exec();
    const [subscription, attempts, streaks, queries, videos, calls, ownedGroups, messages] = await Promise.all([
      this.subs.findOne({ user_id: clerkId }).lean().exec(),
      this.attempts.find({ user_id: clerkId }).sort({ _id: 1 }).limit(EXPORT_LIMIT).lean().exec(),
      this.streaks.find({ user_id: clerkId }).sort({ date: 1 }).limit(EXPORT_LIMIT).lean().exec(),
      this.queries.find({ user_id: clerkId }).sort({ _id: 1 }).limit(EXPORT_LIMIT).lean().exec(),
      this.videos.find({ user_id: clerkId }).sort({ _id: 1 }).limit(EXPORT_LIMIT).lean().exec(),
      this.calls
        .find({ all_participant_ids: clerkId })
        .sort({ _id: 1 })
        .limit(EXPORT_LIMIT)
        .lean()
        .exec(),
      this.groups.find({ owner_id: clerkId }).limit(EXPORT_LIMIT).lean().exec(),
      this.messages.find({ sender_id: clerkId }).sort({ _id: 1 }).limit(EXPORT_LIMIT).lean().exec(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      note: 'Clerk identity data (name, email, sessions) is held by Clerk; see their export tools.',
      user,
      subscription,
      attempts,
      streaks,
      aiQueries: queries,
      videoJobs: videos,
      calls,
      ownedGroups,
      messages,
      truncated: {
        attempts: attempts.length === EXPORT_LIMIT,
        streaks: streaks.length === EXPORT_LIMIT,
        aiQueries: queries.length === EXPORT_LIMIT,
        videoJobs: videos.length === EXPORT_LIMIT,
        calls: calls.length === EXPORT_LIMIT,
        messages: messages.length === EXPORT_LIMIT,
      },
    };
  }

  /**
   * Erasure (GDPR art. 17): removes or anonymizes every app-side record.
   * - Owned content (attempts, streaks, AI history, video jobs) is deleted.
   * - Shared records (calls, groups, messages) are anonymized so other members
   *   keep their history without retaining the erased user's reference.
   * - Local video files are removed from disk; R2 objects are deleted by the
   *   storage lifecycle/takedown runbook (see README).
   *
   * Requires `confirm: "DELETE"` from the caller so an accidental request can
   * never wipe an account.
   */
  async erase(clerkId: string, confirmed: boolean) {
    if (!confirmed) {
      throw new BadRequestException('Refusing to erase: pass ?confirm=DELETE to confirm');
    }
    const user = await this.model.findOne({ clerkId }).lean().exec();
    if (!user) throw new BadRequestException('User not found');

    const videoRows = await this.videos
      .find({ user_id: clerkId })
      .select('video_path video_key video_storage')
      .lean()
      .exec();
    const localPaths = videoRows.map((v) => v.video_path).filter((p): p is string => Boolean(p));
    const cloudKeys = videoRows
      .filter((v) => v.video_storage === 'r2' && v.video_key)
      .map((v) => v.video_key as string);

    const counts = await withTransaction(this.connection, async (session) => {
      const opts = session ? { session } : {};
      const [subs, attempts, streaks, queries, videos, initiatedCalls] = await Promise.all([
        this.subs.deleteMany({ user_id: clerkId }, opts).exec(),
        this.attempts.deleteMany({ user_id: clerkId }, opts).exec(),
        this.streaks.deleteMany({ user_id: clerkId }, opts).exec(),
        this.queries.deleteMany({ user_id: clerkId }, opts).exec(),
        this.videos.deleteMany({ user_id: clerkId }, opts).exec(),
        this.calls.deleteMany({ initiator_id: clerkId }, opts).exec(),
      ]);

      // Anonymize the caller in calls they joined but did not initiate.
      await this.calls
        .updateMany(
          { all_participant_ids: clerkId },
          { $pull: { participant_ids: clerkId, all_participant_ids: clerkId } },
          opts,
        )
        .exec();
      await this.calls.updateMany({ invitee_id: clerkId }, { $set: { invitee_id: null } }, opts).exec();

      // Delete owned groups; leave the ones they were only a member of.
      const owned = await this.groups.find({ owner_id: clerkId }).select('_id').lean().exec();
      const removedGroups = await this.groups.deleteMany({ owner_id: clerkId }, opts).exec();
      await this.messages.deleteMany({ group_id: { $in: owned.map((g) => g._id) } }, opts).exec();

      const otherGroups = await this.groups.find({ member_ids: clerkId }).select('_id').lean().exec();
      await this.groups.updateMany({ member_ids: clerkId }, { $pull: { member_ids: clerkId } }, opts).exec();
      for (const g of otherGroups) {
        const members = await this.groups.findById(g._id).select('member_ids').lean().exec();
        await this.groups
          .updateOne({ _id: g._id }, { $set: { member_count: members?.member_ids.length ?? 0 } }, opts)
          .exec();
      }

      const messages = await this.messages.deleteMany({ sender_id: clerkId }, opts).exec();
      await this.messages.updateMany(
        { read_by: clerkId },
        { $pull: { read_by: clerkId } },
        opts,
      ).exec();
      // Scrub chat reactions (map of emoji → user ids) so no reference to the
      // erased user remains in shared history. Emoji buckets left empty are
      // dropped. Uses an aggregation-pipeline update (Mongo 4.2+).
      await this.messages
        .updateMany(
          { reactions: { $ne: null } },
          [
            {
              $set: {
                reactions: {
                  $arrayToObject: {
                    $filter: {
                      input: {
                        $map: {
                          input: { $objectToArray: { $ifNull: ['$reactions', {}] } },
                          as: 'reaction',
                          in: {
                            k: '$$reaction.k',
                            v: { $setDifference: ['$$reaction.v', [clerkId]] },
                          },
                        },
                      },
                      as: 'reaction',
                      cond: { $gt: [{ $size: '$$reaction.v' }, 0] },
                    },
                  },
                },
              },
            },
          ],
          opts,
        )
        .exec();

      // Scrub live leaderboards + historical snapshots so the erasure is real.
      await this.snapshots
        .updateMany({ 'entries.user_id': clerkId }, { $pull: { entries: { user_id: clerkId } } }, opts)
        .exec();

      const removed = await this.model.deleteOne({ clerkId }, opts).exec();

      return {
        users: removed.deletedCount ?? 0,
        subscriptions: subs.deletedCount ?? 0,
        attempts: attempts.deletedCount ?? 0,
        streaks: streaks.deletedCount ?? 0,
        aiQueries: queries.deletedCount ?? 0,
        videoJobs: videos.deletedCount ?? 0,
        callsInitiated: initiatedCalls.deletedCount ?? 0,
        groupsOwned: removedGroups.deletedCount ?? 0,
        messages: messages.deletedCount ?? 0,
      };
    });

    if (this.redis) {
      try {
        await this.scrubLeaderboard(clerkId);
      } catch {
        /* best effort — Redis boards expire after 3 days */
      }
    }
    if (localPaths.length > 0) {
      await Promise.all(
        localPaths.map((p) => fs.rm(p, { force: true }).catch(() => undefined)),
      );
    }
    // Remove rendered objects from cloud storage (best effort; bucket lifecycle
    // rules are the backstop).
    const storage = r2Configured() ? new R2VideoStorage() : null;
    if (storage && cloudKeys.length > 0) {
      await Promise.all(
        cloudKeys.map((key) =>
          storage.remove(key).catch(() => undefined),
        ),
      );
    }
    return {
      erased: true,
      clerkId,
      counts,
      localFilesRemoved: localPaths.length,
      cloudObjectsRemoved: storage ? cloudKeys.length : 0,
    };
  }

  /** Remove the user from all live daily boards and name hashes. */
  private async scrubLeaderboard(clerkId: string): Promise<void> {
    if (!this.redis) return;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', 'lb:*', 'COUNT', 200);
      cursor = next;
      const daily = keys.filter((k) => k.startsWith('lb:daily:'));
      const names = keys.filter((k) => k.startsWith('lb:names:'));
      if (daily.length || names.length) {
        const pipeline = this.redis.pipeline();
        for (const key of daily) pipeline.zrem(key, clerkId);
        for (const key of names) pipeline.hdel(key, clerkId);
        await pipeline.exec();
      }
    } while (cursor !== '0');
  }
}
