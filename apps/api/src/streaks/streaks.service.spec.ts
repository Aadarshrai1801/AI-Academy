import {
  StreaksService,
  dayDistance,
  effectiveCurrentStreak,
  effectiveFreezes,
  missedDates,
  monthKey,
  prevLocalDate,
  toLocalDate,
} from './streaks.service.js';

/**
 * Streak behavior is date-sensitive, so these tests drive the real service
 * against fake Mongoose models and a fake clock. They cover the day-rollover
 * matrix (UTC, western, eastern including UTC+12…+14 where a 24h-at-noon date
 * anchor used to break), duplicate attempts, gaps, DST, and the Pro freeze
 * bank (monthly refill, consumption, audit document).
 */

class FakeStreakModel {
  docs = new Map<string, any>();

  findOneAndUpdate(filter: any, update: any) {
    const store = this.docs;
    return {
      exec: async () => {
        const key = `${filter.user_id}|${filter.date}`;
        let doc = store.get(key);
        if (!doc) {
          doc = {
            user_id: filter.user_id,
            date: filter.date,
            activity_count: 0,
            streak_day_number: 0,
            freeze_applied: false,
          };
          store.set(key, doc);
        }
        doc.activity_count += update.$inc.activity_count;
        doc.save = async () => undefined;
        return doc;
      },
    };
  }

  updateOne(filter: any, update: any) {
    const store = this.docs;
    return {
      exec: async () => {
        const key = `${filter.user_id}|${filter.date}`;
        if (!store.has(key) && update.$setOnInsert) {
          store.set(key, { user_id: filter.user_id, date: filter.date, ...update.$setOnInsert });
        }
        return { acknowledged: true };
      },
    };
  }
}

class FakeUserModel {
  doc: any = null;

  findOne = (_filter: any) => {
    const chain: any = { session: () => chain, exec: async () => this.doc };
    return chain;
  };

  findOneAndUpdate = (filter: any, update: any) => ({
    exec: async () => {
      this.doc = { ...(this.doc ?? { clerkId: filter.clerkId }), ...update };
      return this.doc;
    },
  });
}

function makeService(options: { timeZone?: string; role?: string; freezes?: number; freezeMonth?: string | null } = {}) {
  const streaks = new FakeStreakModel();
  const users = new FakeUserModel();
  users.doc = {
    clerkId: 'u1',
    timezone: options.timeZone ?? 'UTC',
    role: options.role ?? 'free',
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null,
    streak_freezes_available: options.freezes ?? 0,
    streak_freeze_month: options.freezeMonth ?? null,
  };
  const service = new StreaksService(streaks as any, users as any);
  return { service, streaks, users };
}

async function attemptAt(service: StreaksService, iso: string) {
  vi.setSystemTime(new Date(iso));
  return service.recordAttempt('u1');
}

describe('streak date helpers', () => {
  it('prevLocalDate is pure calendar arithmetic for every offset', () => {
    expect(prevLocalDate('2026-09-11')).toBe('2026-09-10');
    expect(prevLocalDate('2026-01-01')).toBe('2025-12-31');
    expect(prevLocalDate('2026-03-01')).toBe('2026-02-28');
  });

  it('toLocalDate honours the user timezone at the day boundary', () => {
    expect(toLocalDate(new Date('2026-09-10T09:00:00Z'), 'UTC')).toBe('2026-09-10');
    expect(toLocalDate(new Date('2026-09-10T23:30:00Z'), 'UTC')).toBe('2026-09-10');
    expect(toLocalDate(new Date('2026-09-10T09:00:00Z'), 'Pacific/Kiritimati')).toBe('2026-09-10');
    expect(toLocalDate(new Date('2026-09-10T12:00:00Z'), 'Pacific/Kiritimati')).toBe('2026-09-11');
    expect(toLocalDate(new Date('2026-09-10T02:00:00Z'), 'America/New_York')).toBe('2026-09-09');
  });

  it('dayDistance and missedDates count whole calendar days', () => {
    expect(dayDistance('2026-09-10', '2026-09-11')).toBe(1);
    expect(dayDistance('2026-09-10', '2026-09-13')).toBe(3);
    expect(dayDistance('2025-12-31', '2026-01-01')).toBe(1);
    expect(missedDates('2026-09-10', '2026-09-12')).toEqual(['2026-09-11']);
    expect(missedDates('2026-09-10', '2026-09-13')).toEqual(['2026-09-11', '2026-09-12']);
    expect(missedDates('2026-09-10', '2026-09-11')).toEqual([]);
  });

  it('effectiveCurrentStreak only reports genuinely alive (or rescuable) streaks', () => {
    const user = { current_streak: 5, last_activity_date: '2026-09-10' };
    expect(effectiveCurrentStreak(user, '2026-09-10')).toBe(5);
    expect(effectiveCurrentStreak(user, '2026-09-11')).toBe(5);
    expect(effectiveCurrentStreak(user, '2026-09-12', 1)).toBe(5); // one missed day + freeze
    expect(effectiveCurrentStreak(user, '2026-09-12', 0)).toBe(0); // missed day, no freeze
    expect(effectiveCurrentStreak(user, '2026-09-13', 1)).toBe(0); // two missed days
    expect(effectiveCurrentStreak({ current_streak: 0, last_activity_date: null }, '2026-09-12')).toBe(0);
  });

  it('effectiveFreezes refills monthly and only for Pro/Admin', () => {
    expect(effectiveFreezes({ role: 'pro', streak_freezes_available: 0, streak_freeze_month: '2026-08' }, '2026-09')).toBe(1);
    expect(effectiveFreezes({ role: 'pro', streak_freezes_available: 0, streak_freeze_month: '2026-09' }, '2026-09')).toBe(0);
    expect(effectiveFreezes({ role: 'admin', streak_freezes_available: 1, streak_freeze_month: '2026-09' }, '2026-09')).toBe(1);
    expect(effectiveFreezes({ role: 'free', streak_freezes_available: 1, streak_freeze_month: null }, '2026-09')).toBe(0);
    expect(monthKey('2026-09-17')).toBe('2026-09');
  });
});

describe('StreaksService.recordAttempt', () => {
  afterEach(() => vi.useRealTimers());

  it('UTC: five consecutive local days increase 1..5', async () => {
    vi.useFakeTimers();
    const { service } = makeService();
    const results = [];
    for (const day of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']) {
      results.push(await attemptAt(service, `${day}T10:00:00Z`));
    }
    expect(results.map((r) => r.current)).toEqual([1, 2, 3, 4, 5]);
    expect(results.at(-1)!.longest).toBe(5);
  });

  it('three attempts on the same day count once but all attempts are logged', async () => {
    vi.useFakeTimers();
    const { service } = makeService();
    const a = await attemptAt(service, '2026-09-10T08:00:00Z');
    const b = await attemptAt(service, '2026-09-10T12:00:00Z');
    const c = await attemptAt(service, '2026-09-10T23:00:00Z');
    expect([a.current, b.current, c.current]).toEqual([1, 1, 1]);
    expect([a.todayCount, b.todayCount, c.todayCount]).toEqual([1, 2, 3]);
  });

  it('a missed day resets the streak to 1', async () => {
    vi.useFakeTimers();
    const { service } = makeService();
    await attemptAt(service, '2026-09-10T10:00:00Z');
    const gap = await attemptAt(service, '2026-09-12T10:00:00Z');
    expect(gap.current).toBe(1);
    expect(gap.freezeApplied).toBe(false);
  });

  it('America/New_York (UTC−4) consecutive local days increase', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ timeZone: 'America/New_York' });
    const first = await attemptAt(service, '2026-09-10T02:00:00Z'); // 2026-09-09 22:00 EDT
    const second = await attemptAt(service, '2026-09-11T02:00:00Z'); // 2026-09-10 22:00 EDT
    expect([first.current, second.current]).toEqual([1, 2]);
  });

  it('Pacific/Auckland (UTC+12) consecutive local days increase', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ timeZone: 'Pacific/Auckland' });
    const first = await attemptAt(service, '2026-09-10T00:00:00Z'); // 2026-09-10 12:00 NZST
    const second = await attemptAt(service, '2026-09-11T00:00:00Z'); // 2026-09-11 12:00 NZST
    expect([first.current, second.current]).toEqual([1, 2]);
  });

  it('Pacific/Kiritimati (UTC+14) consecutive local days increase', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ timeZone: 'Pacific/Kiritimati' });
    const first = await attemptAt(service, '2026-09-10T00:00:00Z'); // 2026-09-10 14:00 +14
    const second = await attemptAt(service, '2026-09-11T00:00:00Z'); // 2026-09-11 14:00 +14
    expect([first.current, second.current]).toEqual([1, 2]);
  });

  it('DST transition does not break consecutive local days', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ timeZone: 'America/New_York' });
    const before = await attemptAt(service, '2026-10-31T14:00:00Z'); // 10:00 EDT
    const after = await attemptAt(service, '2026-11-01T15:00:00Z'); // 10:00 EST (fall back)
    expect([before.current, after.current]).toEqual([1, 2]);
  });

  it('Pro: monthly freeze is granted and consumed to bridge one missed day', async () => {
    vi.useFakeTimers();
    const { service, streaks } = makeService({ role: 'pro' });
    const monday = await attemptAt(service, '2026-09-07T10:00:00Z');
    expect(monday.current).toBe(1);
    expect(monday.freezesAvailable).toBe(1); // monthly refill materialised

    const wednesday = await attemptAt(service, '2026-09-09T10:00:00Z'); // skipped Tuesday
    expect(wednesday.freezeApplied).toBe(true);
    expect(wednesday.current).toBe(2); // frozen day protects, today extends
    expect(wednesday.freezesAvailable).toBe(0);

    const frozenDoc = streaks.docs.get('u1|2026-09-08');
    expect(frozenDoc).toMatchObject({ activity_count: 0, freeze_applied: true });
  });

  it('Pro: freeze is not re-granted within the same month, but returns next month', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ role: 'pro' });
    await attemptAt(service, '2026-09-07T10:00:00Z');
    await attemptAt(service, '2026-09-09T10:00:00Z'); // consumes the freeze
    const sameMonth = await attemptAt(service, '2026-09-11T10:00:00Z');
    expect(sameMonth.freezesAvailable).toBe(0);
    expect(sameMonth.freezeApplied).toBe(false); // gap resets instead of freezing

    const nextMonth = await attemptAt(service, '2026-10-05T10:00:00Z');
    expect(nextMonth.freezesAvailable).toBe(1); // October refill
  });

  it('Pro: a two-day gap exceeds the single freeze and resets', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ role: 'pro' });
    await attemptAt(service, '2026-09-07T10:00:00Z');
    const later = await attemptAt(service, '2026-09-10T10:00:00Z'); // missed 09-08 and 09-09
    expect(later.freezeApplied).toBe(false);
    expect(later.current).toBe(1);
  });

  it('free users never consume a freeze', async () => {
    vi.useFakeTimers();
    const { service } = makeService({ role: 'free', freezes: 1, freezeMonth: '2026-09' });
    await attemptAt(service, '2026-09-07T10:00:00Z');
    const afterGap = await attemptAt(service, '2026-09-09T10:00:00Z');
    expect(afterGap.freezeApplied).toBe(false);
    expect(afterGap.current).toBe(1);
    expect(afterGap.freezesAvailable).toBe(0);
  });
});
