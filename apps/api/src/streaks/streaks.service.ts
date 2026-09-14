import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Streak, StreakDocument } from './streak.schema.js';
import { User, UserDocument } from '../users/user.schema.js';

/** Attempts/day within a UTC day that grow the streak (spec §2.3; default 1). */
export const STREAK_QUALIFYING_ATTEMPTS = 1;

function toLocalDate(d: Date, timeZone: string): string {
  // en-CA yields YYYY-MM-DD; honoring the user's timezone (spec §2.3 edge case).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function prevLocalDate(dateStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcNoon = Date.UTC(y, m - 1, d, 12) - 86400000;
  return toLocalDate(new Date(utcNoon), timeZone);
}

/**
 * Idempotent daily streaks (spec §2.3): increments at most once per day,
 * consecutive local dates extend, gaps reset. Freezes land with Pro (Phase 3+).
 */
@Injectable()
export class StreaksService {
  constructor(
    @InjectModel(Streak.name) private readonly streaks: Model<StreakDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  async recordAttempt(userId: string, session: ClientSession | null = null) {
    const opts = session ? { session } : {};
    const userQuery = this.users.findOne({ clerkId: userId });
    if (session) userQuery.session(session);
    const user = await userQuery.exec();
    const timeZone = user?.timezone ?? 'UTC';
    const today = toLocalDate(new Date(), timeZone);

    const doc = await this.streaks
      .findOneAndUpdate(
        { user_id: userId, date: today },
        { $inc: { activity_count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, ...opts },
      )
      .exec();

    let current = user?.current_streak ?? 0;
    let longest = user?.longest_streak ?? 0;

    // First qualifying activity of the day decides increment vs reset.
    if (doc.activity_count === STREAK_QUALIFYING_ATTEMPTS) {
      const last = user?.last_activity_date ?? null;
      if (last === today) {
        current = user?.current_streak ?? 1; // already counted (backfill edge)
      } else if (last === prevLocalDate(today, timeZone)) {
        current = (user?.current_streak ?? 0) + 1; // consecutive day
      } else {
        current = 1; // gap or first day: reset
      }
      longest = Math.max(longest, current);
      doc.streak_day_number = current;
      await doc.save(session ? { session } : undefined);
      await this.users
        .findOneAndUpdate(
          { clerkId: userId },
          { current_streak: current, longest_streak: longest, last_activity_date: today },
          { upsert: true, ...opts },
        )
        .exec();
    } else {
      current = user?.current_streak ?? current;
      longest = user?.longest_streak ?? longest;
    }

    return {
      current,
      longest,
      todayCount: doc.activity_count,
      qualifyingThreshold: STREAK_QUALIFYING_ATTEMPTS,
    };
  }
}
