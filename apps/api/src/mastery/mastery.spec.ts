import { BadRequestException, ConflictException } from '@nestjs/common';
import { MasteryService } from './mastery.service.js';

/**
 * Mastery model: EMA from graded attempts (hints count less, retries don't
 * count), exponential read-time decay, and one-shot diagnostic seeding.
 */

/** Minimal chainable Mongoose query stub: every method returns the chain. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

const OID = '64abb71ab5f7e9688774dc33';

function makeService(
  opts: {
    record?: Record<string, unknown> | null;
    records?: any[];
    user?: any;
    questions?: any[];
    upsertedCount?: number;
  } = {},
) {
  const saveCalls: any[] = [];
  const existing = opts.record
    ? {
        ...opts.record,
        save: async function (this: any) {
          saveCalls.push({ score: this.score, attempts: this.attempts_counted });
        },
      }
    : null;
  const updateCalls: any[] = [];
  const mastery = {
    findOne: () => chain(existing),
    updateOne: (filter: any, update: any, o?: any) => {
      updateCalls.push({ filter, update, opts: o });
      return chain({ upsertedCount: opts.upsertedCount ?? 1 });
    },
    find: () => chain(opts.records ?? []),
  };
  const questions = {
    find: () => chain(opts.questions ?? []),
    aggregate: () => chain([]),
  };
  const userUpdateCalls: any[] = [];
  const users = {
    findOne: () => chain(opts.user ?? null),
    updateOne: (filter: any, update: any, o?: any) => {
      userUpdateCalls.push({ filter, update, o });
      return chain({});
    },
  };
  const service = new MasteryService(mastery as any, questions as any, users as any);
  return { service, saveCalls, updateCalls, userUpdateCalls };
}

describe('MasteryService — decay + bands', () => {
  it('halves a score after one half-life', () => {
    const { service } = makeService();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    expect(service.decayedScore(100, thirtyDaysAgo)).toBeCloseTo(50, 5);
    expect(service.decayedScore(80, new Date())).toBeCloseTo(80, 5);
    expect(service.decayedScore(42, null)).toBe(42);
  });

  it('maps scores to recommended difficulty bands', () => {
    const { service } = makeService();
    expect(service.recommendedDifficulty(0)).toBe('easy');
    expect(service.recommendedDifficulty(39.9)).toBe('easy');
    expect(service.recommendedDifficulty(40)).toBe('medium');
    expect(service.recommendedDifficulty(69.9)).toBe('medium');
    expect(service.recommendedDifficulty(70)).toBe('hard');
    expect(service.recommendedDifficulty(100)).toBe('hard');
  });
});

describe('MasteryService — attempt EMA', () => {
  it('ignores reveal-assisted retries entirely', async () => {
    const { service, updateCalls, saveCalls } = makeService();
    await service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'easy',
      isCorrect: true,
      isRetry: true,
    });
    expect(updateCalls).toHaveLength(0);
    expect(saveCalls).toHaveLength(0);
  });

  it('creates the first record with a difficulty-scaled seed', async () => {
    const { service, updateCalls } = makeService();
    await service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'medium',
      isCorrect: true,
      isRetry: false,
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].opts).toMatchObject({ upsert: true });
    expect(updateCalls[0].update.$setOnInsert).toMatchObject({
      score: 20, // alpha 0.2 × 100 × medium(1)
      source: 'attempts',
      attempts_counted: 1,
      correct_counted: 1,
    });

    const wrong = makeService();
    await wrong.service.recordAttempt('u1', {
      topic: 'llms',
      difficulty: 'hard',
      isCorrect: false,
      isRetry: false,
    });
    expect(wrong.updateCalls[0].update.$setOnInsert.score).toBe(0);
  });

  it('nudges an existing score up on a correct answer', async () => {
    const { service, saveCalls } = makeService({
      record: { score: 50, attempts_counted: 4, correct_counted: 3 },
    });
    await service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'medium',
      isCorrect: true,
      isRetry: false,
    });
    expect(saveCalls[0].score).toBeCloseTo(60, 5); // 50 + 0.2 × 50
    expect(saveCalls[0].attempts).toBe(5);
  });

  it('discounts hint-assisted gains and penalises hint-assisted misses', async () => {
    const hinted = makeService({ record: { score: 50, attempts_counted: 1, correct_counted: 1 } });
    await hinted.service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'medium',
      isCorrect: true,
      isRetry: false,
      hintUsed: true,
    });
    expect(hinted.saveCalls[0].score).toBeCloseTo(55, 5); // half the gain

    const missed = makeService({ record: { score: 50, attempts_counted: 1, correct_counted: 0 } });
    await missed.service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'medium',
      isCorrect: false,
      isRetry: false,
      hintUsed: true,
    });
    expect(missed.saveCalls[0].score).toBeCloseTo(37.5, 5); // 50 − 0.2 × 50 × 1.25
  });

  it('clamps the score to 0..100', async () => {
    const high = makeService({ record: { score: 99, attempts_counted: 1, correct_counted: 1 } });
    await high.service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'hard',
      isCorrect: true,
      isRetry: false,
    });
    expect(high.saveCalls[0].score).toBeLessThanOrEqual(100);

    const low = makeService({ record: { score: 2, attempts_counted: 1, correct_counted: 0 } });
    await low.service.recordAttempt('u1', {
      topic: 'ml-basics',
      difficulty: 'easy',
      isCorrect: false,
      isRetry: false,
    });
    expect(low.saveCalls[0].score).toBeGreaterThanOrEqual(0);
  });
});

describe('MasteryService — serving recommendations', () => {
  it('maps decayed scores to per-topic difficulty recommendations', async () => {
    const { service } = makeService({
      records: [
        { topic: 'ml-basics', score: 30, updated_at: new Date() },
        { topic: 'llms', score: 80, updated_at: new Date() },
      ],
    });
    const recs = await service.recommendedByTopic('u1');
    expect(recs.get('ml-basics')).toBe('easy');
    expect(recs.get('llms')).toBe('hard');
    expect(recs.has('statistics')).toBe(false);
  });

  it('bands on the decayed score, not the raw stored score', async () => {
    const { service } = makeService({
      records: [
        { topic: 'llms', score: 100, updated_at: new Date(Date.now() - 30 * 86_400_000) },
      ],
    });
    const recs = await service.recommendedByTopic('u1');
    // 100 decays to ~50 after one 30-day half-life → medium band.
    expect(recs.get('llms')).toBe('medium');
  });
});

describe('MasteryService — summary', () => {
  it('returns a row per curriculum topic with nulls for untouched topics', async () => {
    const { service } = makeService({
      records: [
        {
          topic: 'ml-basics',
          score: 60,
          source: 'attempts',
          attempts_counted: 10,
          correct_counted: 8,
          updated_at: new Date(),
          history: [
            { day: '2026-09-10', score: 40 },
            { day: '2026-09-19', score: 60 },
          ],
        },
      ],
      user: { onboarding_diagnostic_completed_at: new Date() },
    });
    const summary = await service.summary('u1');
    expect(summary.topics).toHaveLength(6);
    expect(summary.topics[0]).toMatchObject({
      topic: 'ml-basics',
      score: 60,
      attempts: 10,
      correct: 8,
      source: 'attempts',
      recommendedDifficulty: 'medium',
      trend: [40, 60],
      weekChange: 20,
    });
    expect(summary.topics[1]).toMatchObject({ topic: 'statistics', score: null, trend: [], weekChange: null });
    expect(summary.overall).toBe(60);
    expect(summary.diagnosticCompleted).toBe(true);
  });
});

describe('MasteryService — onboarding diagnostic', () => {
  const questions = [
    { _id: OID, topic: 'ml-basics', type: 'mcq', correct_answer: 'A', difficulty: 'easy' },
    {
      _id: '64abb71ab5f7e9688774dc34',
      topic: 'statistics',
      type: 'mcq',
      correct_answer: 'B',
      difficulty: 'medium',
    },
  ];

  it('refuses to grade before a session has been started', async () => {
    const { service } = makeService({ user: { onboarding_diagnostic_question_ids: [] } });
    await expect(
      service.submitDiagnostic('u1', [{ questionId: OID, answer: 'A' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot be retaken once completed', async () => {
    const { service } = makeService({
      user: { onboarding_diagnostic_completed_at: new Date(), onboarding_diagnostic_question_ids: [OID] },
    });
    await expect(
      service.submitDiagnostic('u1', [{ questionId: OID, answer: 'A' }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('grades answers and seeds per-topic scores in one shot', async () => {
    const { service, updateCalls, userUpdateCalls } = makeService({
      user: {
        onboarding_diagnostic_completed_at: null,
        onboarding_diagnostic_question_ids: [OID, '64abb71ab5f7e9688774dc34'],
      },
      questions,
    });
    const result = await service.submitDiagnostic('u1', [
      { questionId: OID, answer: 'a' }, // correct (normalized)
      { questionId: '64abb71ab5f7e9688774dc34', answer: 'wrong' },
    ]);
    expect(result.completed).toBe(true);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
    expect(result.seeded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topic: 'ml-basics', seedScore: 65 }),
        expect.objectContaining({ topic: 'statistics', seedScore: 20 }),
      ]),
    );
    expect(updateCalls.map((c) => c.update.$setOnInsert.source)).toEqual([
      'diagnostic',
      'diagnostic',
    ]);
    expect(userUpdateCalls[0].update.$set).toHaveProperty('onboarding_diagnostic_completed_at');
    expect(userUpdateCalls[0].update.$unset).toEqual({ onboarding_diagnostic_question_ids: 1 });
  });

  it('never overwrites existing practice progress when seeding', async () => {
    const { service } = makeService({
      user: {
        onboarding_diagnostic_completed_at: null,
        onboarding_diagnostic_question_ids: [OID],
      },
      questions: [questions[0]],
      upsertedCount: 0, // update matched an existing record
    });
    const result = await service.submitDiagnostic('u1', [{ questionId: OID, answer: 'A' }]);
    expect(result.seeded).toEqual([]);
  });
});
