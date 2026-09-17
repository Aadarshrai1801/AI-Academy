import { QuestionsService } from './questions.service.js';

/**
 * Serving is free: the daily practice budget is consumed on the FIRST graded
 * attempt per question per day (AttemptsService.submit), never on serve.
 * These tests lock that contract — viewing, refreshing, re-serving, or
 * abandoning a question must not spend quota.
 */

/** Minimal chainable Mongoose query stub: every method returns the chain. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

const QID = '64abb71ab5f7e9688774dc33';

function questionDoc(difficulty = 'easy') {
  return {
    _id: QID,
    topic: 'ml-basics',
    subtopic: 'attention',
    difficulty,
    type: 'mcq',
    prompt: 'What does Q stand for?',
    options: ['Query', 'Key'],
    quality_status: 'approved',
  };
}

function makeService() {
  const attempts = { find: (_filter: any) => chain([]) };
  const updated: unknown[] = [];
  const questions = {
    aggregate: (_pipeline: any) => chain([questionDoc()]),
    findOne: (_filter: any) => chain(questionDoc()),
    updateOne: (filter: any, update: any) => {
      updated.push({ filter, update });
      return chain({});
    },
  };
  const consumeSpy = vi.fn(async () => undefined);
  const refundSpy = vi.fn(async () => undefined);
  const entitlements = {
    check: async () => ({ allowed: true, remaining: 10, limit: 10 }),
    consumeOrThrow: consumeSpy,
    refund: refundSpy,
    resetAt: () => new Date().toISOString(),
  };
  const service = new QuestionsService(questions as any, attempts as any, entitlements as any);
  return { service, consumeSpy, refundSpy, updated };
}

describe('QuestionsService — serving spends no practice quota', () => {
  it('next() serves without consuming or refunding', async () => {
    const { service, consumeSpy, refundSpy } = makeService();
    const q = await service.next('u1', 'free', {});
    expect(q.id).toBe(QID);
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it('byId() serves without consuming or refunding', async () => {
    const { service, consumeSpy, refundSpy } = makeService();
    const q = await service.byId('u1', 'free', QID);
    expect(q.id).toBe(QID);
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it('hard teaser gate still applies on serve', async () => {
    const { service, consumeSpy } = makeService();
    const questions = {
      aggregate: (_pipeline: any) => chain([questionDoc('hard')]),
      findOne: (_filter: any) => chain(questionDoc('hard')),
      updateOne: () => chain({}),
    };
    const hard = new QuestionsService(questions as any, { find: () => chain([]) } as any, {
      check: async () => ({ allowed: false, remaining: 0, limit: 2 }),
      consumeOrThrow: consumeSpy,
      refund: async () => undefined,
      resetAt: () => new Date().toISOString(),
    } as any);
    await expect(hard.next('u1', 'free', { difficulty: 'hard' })).rejects.toMatchObject({ status: 429 });
    expect(service).toBeDefined();
  });
});
