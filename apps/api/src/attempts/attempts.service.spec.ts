import { HttpException, HttpStatus } from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';

/**
 * Attempt-based quota: the daily budget counts distinct questions attempted,
 * not questions served. A retry of an already-attempted (user, question, day)
 * is free and unlimited — graded for feedback but scoreless, leaderboard- and
 * stats-neutral. Only the FIRST attempt of the day consumes one unit and 429s
 * when the budget is spent.
 */

/** Minimal chainable Mongoose query stub: every method returns the chain. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'session', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

const QID = '64abb71ab5f7e9688774dc33';
const DAY = new Date().toISOString().slice(0, 10);

function questionDoc() {
  return {
    _id: QID,
    type: 'mcq',
    correct_answer: 'Paris',
    difficulty: 'easy',
    topic: 'ml-basics',
    quality_status: 'approved',
  };
}

function makeService(opts: { priorToday?: unknown; quotaError?: unknown } = {}) {
  const created: any[] = [];
  const attempts = {
    create: async (docs: any[]) => {
      const rows = docs.map((d, i) => ({ ...d, _id: `attempt${created.length + i}` }));
      created.push(...rows);
      return rows;
    },
    findOne: (_filter: any) => chain(opts.priorToday ?? null),
  };
  const questionUpdates: any[] = [];
  const questions = {
    findById: (_id: any) => chain(questionDoc()),
    updateOne: (filter: any, update: any) => {
      questionUpdates.push({ filter, update });
      return chain({});
    },
  };
  const userUpdates: any[] = [];
  const users = {
    findOneAndUpdate: (filter: any, update: any) => {
      userUpdates.push({ filter, update });
      return chain({});
    },
    findOne: (_filter: any) => chain({ username: 'tester' }),
  };
  const connection = {
    startSession: async () => ({
      withTransaction: async (fn: any) => fn({}),
      endSession: async () => undefined,
    }),
  };
  const streaksService = {
    recordAttempt: async () => ({
      current: 1,
      longest: 1,
      todayCount: 1,
      qualifyingThreshold: 1,
      freezesAvailable: 0,
      freezeApplied: false,
    }),
  };
  const leaderboard = {
    addScore: async (_user: string, _name: string, _pts: number, _day: string) => 15,
    scoreOf: async (_user: string, _day: string) => 15,
  };
  const consumeOrThrow =
    opts.quotaError !== undefined
      ? async () => {
          throw opts.quotaError;
        }
      : async () => undefined;
  const entitlements = { consumeOrThrow };

  const service = new AttemptsService(
    attempts as any,
    questions as any,
    users as any,
    {} as any,
    connection as any,
    streaksService as any,
    leaderboard as any,
    entitlements as any,
  );
  const spies = {
    consumeSpy: vi.fn(entitlements.consumeOrThrow),
    addScoreSpy: vi.fn(leaderboard.addScore),
    scoreOfSpy: vi.fn(leaderboard.scoreOf),
  };
  (service as any).entitlements = { consumeOrThrow: spies.consumeSpy };
  (service as any).leaderboard = { addScore: spies.addScoreSpy, scoreOf: spies.scoreOfSpy };
  return { service, created, questionUpdates, userUpdates, ...spies };
}

const submitInput = { questionId: QID, answer: 'Paris', timeTakenMs: 5000 };

describe('AttemptsService.submit — attempt-based quota', () => {
  it('first attempt of the day consumes one unit and scores', async () => {
    const { service, created, consumeSpy, addScoreSpy } = makeService();
    const res = await service.submit('u1', 'free', submitInput);

    expect(consumeSpy).toHaveBeenCalledTimes(1);
    expect(consumeSpy).toHaveBeenCalledWith('u1', 'free', 'practice_questions');
    expect(res.isRetry).toBe(false);
    expect(res.isCorrect).toBe(true);
    expect(res.pointsAwarded).toBe(15); // easy base 10 × 1.5 speed bonus
    expect(created).toHaveLength(1);
    expect(created[0].points_awarded).toBe(15);
    expect(created[0].day_bucket).toBe(DAY);
    expect(addScoreSpy).toHaveBeenCalledTimes(1);
    expect(res.dailyScore).toBe(15);
  });

  it('retry of the same question the same day is free, scoreless, and board-neutral', async () => {
    const { service, created, questionUpdates, consumeSpy, addScoreSpy, scoreOfSpy } = makeService({
      priorToday: { _id: 'attempt0' },
    });
    const res = await service.submit('u1', 'free', submitInput);

    expect(consumeSpy).not.toHaveBeenCalled();
    expect(res.isRetry).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(res.pointsAwarded).toBe(0);
    expect(created).toHaveLength(1); // still audited…
    expect(created[0].points_awarded).toBe(0);
    expect(questionUpdates).toHaveLength(0); // …but question stats untouched
    expect(addScoreSpy).not.toHaveBeenCalled();
    expect(scoreOfSpy).toHaveBeenCalledWith('u1', DAY);
    expect(res.dailyScore).toBe(15);
  });

  it('exhausted quota rejects a NEW question with 429 and spends nothing', async () => {
    const quotaError = new HttpException(
      { statusCode: 429, error: 'Quota exhausted', feature: 'practice_questions', limit: 10 },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    const { service, created, addScoreSpy } = makeService({ quotaError });
    await expect(service.submit('u1', 'free', submitInput)).rejects.toMatchObject({ status: 429 });
    expect(created).toHaveLength(0);
    expect(addScoreSpy).not.toHaveBeenCalled();
  });

  it('exhausted quota still allows a free retry', async () => {
    const quotaError = new HttpException({ statusCode: 429, error: 'Quota exhausted' }, HttpStatus.TOO_MANY_REQUESTS);
    const { service, consumeSpy } = makeService({ priorToday: { _id: 'attempt0' }, quotaError });
    const res = await service.submit('u1', 'free', { ...submitInput, answer: 'London' });

    expect(consumeSpy).not.toHaveBeenCalled();
    expect(res.isRetry).toBe(true);
    expect(res.isCorrect).toBe(false);
    expect(res.pointsAwarded).toBe(0);
  });

  it('invalid question 404s before any quota is spent', async () => {
    const { service, consumeSpy } = makeService();
    await expect(
      service.submit('u1', 'free', { ...submitInput, questionId: 'not-an-id' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(consumeSpy).not.toHaveBeenCalled();
  });
});
