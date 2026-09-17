import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { Streak, StreakDocument } from './streak.schema.js';
import { User, UserDocument } from '../users/user.schema.js';

/** Attempts/day within a local day that grow the streak (spec §2.3; default 1). */
export const STREAK_QUALIFYING_ATTEMPTS = 1;

/** Pro/Admin freeze allowance: one auto-replenishing freeze per calendar month. */
export const MONTHLY_STREAK_FREEZES = 1;

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` for `d` in the user's timezone (en-CA formats ISO-style). */
export function toLocalDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Shift a `YYYY-MM-DD` calendar date by whole days (pure date arithmetic). */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + deltaDays * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Previous calendar date.
 *
 * Pure calendar arithmetic on the date string — deliberately **not** a
 * "noon UTC minus 24h then format in the user's timezone" round-trip: that
 * anchor rolls back onto the same date for offsets ≥ UTC+12 (Auckland,
 * Kiritimati), which silently reset streaks for those users.
 */
export function prevLocalDate(dateStr: string): string {
  return shiftDate(dateStr, -1);
}

/** Whole calendar days between two `YYYY-MM-DD` strings (`to` − `from`). */
export function dayDistance(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY);
}

/** `YYYY-MM` bucket used for the monthly freeze refill. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** The dates strictly between `from` and `to` (the days a freeze would cover). */
export function missedDates(from: string, to: string): string[] {
  const count = dayDistance(from, to) - 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => shiftDate(from, i + 1));
}

/**
 * Streak value for display. The cached `current_streak` is only rewritten on
 * the next graded attempt, so a streak that is already broken would otherwise
 * keep showing as "active" until the user answers.
 *
 * A streak is alive while the last activity is today or yesterday. It is also
 * still rescuable when exactly one day was missed and a freeze is banked —
 * that freeze is consumed on the next graded attempt.
 */
export function effectiveCurrentStreak(
  user:
    | { current_streak?: number; last_activity_date?: string | null }
    | null
    | undefined,
  today: string,
  freezesAvailable = 0,
): number {
  if (!user?.current_streak) return 0;
  const last = user.last_activity_date ?? null;
  if (!last) return 0;
  if (last === today || last === prevLocalDate(today)) return user.current_streak;
  if (dayDistance(last, today) === 2 && freezesAvailable > 0) return user.current_streak;
  return 0;
}

/**
 * Effective freeze bank. Pro/Admin refill to one at the start of each local
 * month; reads compute the refill so the UI is honest before the next attempt
 * materialises it.
 */
export function effectiveFreezes(
  user:
    | {
        role?: string;
        streak_freezes_available?: number;
        streak_freeze_month?: string | null;
      }
    | null
    | undefined,
  month: string,
): number {
  if (!user || (user.role !== 'pro' && user.role !== 'admin')) return 0;
  if (user.streak_freeze_month !== month) return MONTHLY_STREAK_FREEZES;
  return user.streak_freezes_available ?? 0;
}

/**
 * Idempotent daily streaks (spec §2.3): increments at most once per day,
 * consecutive local dates extend, gaps reset — unless the Pro freeze bank
 * covers the missed day(s), in which case the streak survives the gap and the
 * frozen day is written to the audit log with `freeze_applied: true`.
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
    const month = monthKey(today);

    const doc = await this.streaks
      .findOneAndUpdate(
        { user_id: userId, date: today },
        { $inc: { activity_count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, ...opts },
      )
      .exec();

    // Monthly freeze refill (Pro/Admin only); materialised here, computed on reads.
    let freezesAvailable = effectiveFreezes(user, month);
    const freezeState: Record<string, unknown> = {
      streak_freezes_available: freezesAvailable,
      streak_freeze_month: month,
    };

    let current = user?.current_streak ?? 0;
    let longest = user?.longest_streak ?? 0;
    let freezeApplied = false;

    // First qualifying activity of the day decides increment vs reset vs freeze.
    if (doc.activity_count === STREAK_QUALIFYING_ATTEMPTS) {
      const last = user?.last_activity_date ?? null;
      const frozen: string[] = [];

      if (last === today) {
        current = user?.current_streak ?? 1; // already counted (backfill edge)
      } else if (last === prevLocalDate(today)) {
        current = (user?.current_streak ?? 0) + 1; // consecutive day
      } else if (last && current > 0) {
        const missed = dayDistance(last, today) - 1;
        if (missed >= 1 && missed <= freezesAvailable) {
          // The bank covers the gap: the streak survives, today extends it, and
          // the frozen days are audited. Frozen days never advance the count.
          frozen.push(...missedDates(last, today));
          current += 1;
          freezeApplied = true;
        } else {
          current = 1; // gap larger than the bank: reset
        }
      } else {
        current = 1; // first day
      }

      longest = Math.max(longest, current);
      doc.streak_day_number = current;
      await doc.save(session ? { session } : undefined);

      for (const date of frozen) {
        await this.streaks
          .updateOne(
            { user_id: userId, date },
            {
              $setOnInsert: {
                activity_count: 0,
                freeze_applied: true,
                streak_day_number: current,
              },
            },
            { upsert: true, ...opts },
          )
          .exec();
      }

      if (frozen.length > 0) {
        freezesAvailable -= frozen.length;
        freezeState.streak_freezes_available = freezesAvailable;
      }

      await this.users
        .findOneAndUpdate(
          { clerkId: userId },
          {
            current_streak: current,
            longest_streak: longest,
            last_activity_date: today,
            ...freezeState,
          },
          { upsert: true, ...opts },
        )
        .exec();
    } else {
      // Later attempts on the same day never move the streak, but the monthly
      // freeze refill still materialises.
      await this.users
        .findOneAndUpdate({ clerkId: userId }, freezeState, { upsert: true, ...opts })
        .exec();
    }

    return {
      current,
      longest,
      todayCount: doc.activity_count,
      qualifyingThreshold: STREAK_QUALIFYING_ATTEMPTS,
      freezesAvailable: freezeState.streak_freezes_available as number,
      freezeApplied,
    };
  }
}
