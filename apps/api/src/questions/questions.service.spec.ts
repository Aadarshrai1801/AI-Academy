import { HttpException, HttpStatus } from '@nestjs/common';
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
  const curriculum = {
    assertTopicAccess: async () => undefined,
    lockedTopics: async () => [] as string[],
  };
  const mastery = { recommendedByTopic: async () => new Map() };
  const service = new QuestionsService(
    questions as any,
    attempts as any,
    entitlements as any,
    curriculum as any,
    mastery as any,
  );
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
    } as any, {
      assertTopicAccess: async () => undefined,
      lockedTopics: async () => [],
    } as any, {
      recommendedByTopic: async () => new Map(),
    } as any);
    await expect(hard.next('u1', 'free', { difficulty: 'hard' })).rejects.toMatchObject({ status: 429 });
    expect(service).toBeDefined();
  });
});

describe('QuestionsService — learning-path gating', () => {
  const locked = new HttpException(
    { statusCode: 403, error: 'Topic locked', feature: 'topic_locked', topic: 'llms' },
    HttpStatus.FORBIDDEN,
  );

  function makeGated(
    lockedTopics: string[],
    assert: (userId: string, role: string, topic: string) => Promise<void> = async () =>
      undefined,
  ) {
    const pipelines: any[][] = [];
    const questions = {
      aggregate: (pipeline: any) => {
        pipelines.push(pipeline);
        return chain([questionDoc()]);
      },
      findOne: () => chain(questionDoc()),
      updateOne: () => chain({}),
    };
    const curriculum = { assertTopicAccess: assert, lockedTopics: async () => lockedTopics };
    const service = new QuestionsService(
      questions as any,
      { find: () => chain([]) } as any,
      {
        check: async () => ({ allowed: true, remaining: 10, limit: 10 }),
        consumeOrThrow: async () => undefined,
        refund: async () => undefined,
        resetAt: () => new Date().toISOString(),
      } as any,
      curriculum as any,
      { recommendedByTopic: async () => new Map() } as any,
    );
    return { service, pipelines };
  }

  it('rejects a locked topic with an actionable 403', async () => {
    const assert = vi.fn(async () => {
      throw locked;
    });
    const { service } = makeGated([], assert);
    const err = await service.next('u1', 'free', { topic: 'llms' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(assert).toHaveBeenCalledWith('u1', 'free', 'llms');
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(403);
    expect((err as HttpException).getResponse()).toMatchObject({ feature: 'topic_locked' });
  });

  it('excludes locked topics from random serving', async () => {
    const { service, pipelines } = makeGated(['llms', 'deep-learning']);
    await service.next('u1', 'free', {});
    expect((pipelines[0][0] as any).$match.topic.$nin).toEqual(['llms', 'deep-learning']);
  });

  it('does not exclude anything when no topic is locked', async () => {
    const { service, pipelines } = makeGated([]);
    await service.next('u1', 'free', {});
    expect((pipelines[0][0] as any).$match.topic).toBeUndefined();
  });
});

describe('QuestionsService — adaptive difficulty (Phase 13)', () => {
  function makeAdaptive(opts: {
    recs?: Array<[string, 'easy' | 'medium' | 'hard']>;
    locked?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
    topic?: string;
  }) {
    const pipelines: any[][] = [];
    const questions = {
      aggregate: (pipeline: any) => {
        pipelines.push(pipeline);
        return chain([questionDoc()]);
      },
      findOne: () => chain(questionDoc()),
      updateOne: () => chain({}),
    };
    const curriculum = {
      assertTopicAccess: async () => undefined,
      lockedTopics: async () => opts.locked ?? [],
    };
    const mastery = { recommendedByTopic: async () => new Map(opts.recs ?? []) };
    const service = new QuestionsService(
      questions as any,
      { find: () => chain([]) } as any,
      {
        check: async () => ({ allowed: true, remaining: 10, limit: 10 }),
        consumeOrThrow: async () => undefined,
        refund: async () => undefined,
        resetAt: () => new Date().toISOString(),
      } as any,
      curriculum as any,
      mastery as any,
    );
    return { service, pipelines };
  }

  it('targets the mastery band per topic when no difficulty is pinned', async () => {
    const { service, pipelines } = makeAdaptive({
      recs: [
        ['ml-basics', 'medium'],
        ['llms', 'hard'],
      ],
    });
    const q = await service.next('u1', 'pro', {});
    expect(q.adaptive).toBe(true);
    expect((pipelines[0][0] as any).$match.$or).toEqual(
      expect.arrayContaining([
        { topic: 'ml-basics', difficulty: 'medium' },
        { topic: 'llms', difficulty: 'hard' },
        { topic: 'statistics', difficulty: 'easy' }, // default for no history
      ]),
    );
  });

  it('caps free tier at medium so the hard teaser keeps its meaning', async () => {
    const { service, pipelines } = makeAdaptive({ recs: [['llms', 'hard']] });
    await service.next('u1', 'free', {});
    const pairs = (pipelines[0][0] as any).$match.$or as Array<{ topic: string; difficulty: string }>;
    expect(pairs.find((p) => p.topic === 'llms')?.difficulty).toBe('medium');
  });

  it('hands explicit difficulty requests through unchanged', async () => {
    const { service, pipelines } = makeAdaptive({ recs: [['ml-basics', 'hard']] });
    const q = await service.next('u1', 'pro', { difficulty: 'easy' });
    expect(q.adaptive).toBe(false);
    expect((pipelines[0][0] as any).$match.difficulty).toBe('easy');
    expect((pipelines[0][0] as any).$match.$or).toBeUndefined();
  });

  it('uses a single topic equality when a topic is pinned', async () => {
    const { service, pipelines } = makeAdaptive({ recs: [['ml-basics', 'medium']] });
    const q = await service.next('u1', 'pro', { topic: 'ml-basics' });
    expect(q.adaptive).toBe(true);
    expect((pipelines[0][0] as any).$match.difficulty).toBe('medium');
    expect((pipelines[0][0] as any).$match.$or).toBeUndefined();
  });

  it('leaves admins unfiltered', async () => {
    const { service, pipelines } = makeAdaptive({ recs: [['ml-basics', 'hard']] });
    const q = await service.next('u1', 'admin', {});
    expect(q.adaptive).toBe(false);
    expect((pipelines[0][0] as any).$match.$or).toBeUndefined();
  });

  it('relaxes the adaptive filter when the bank has no matching cell', async () => {
    const pipelines: any[][] = [];
    let call = 0;
    const questions = {
      aggregate: (pipeline: any) => {
        pipelines.push(pipeline);
        call += 1;
        return chain(call === 1 ? [] : [questionDoc()]);
      },
      findOne: () => chain(questionDoc()),
      updateOne: () => chain({}),
    };
    const service = new QuestionsService(
      questions as any,
      { find: () => chain([]) } as any,
      {
        check: async () => ({ allowed: true, remaining: 10, limit: 10 }),
        consumeOrThrow: async () => undefined,
        refund: async () => undefined,
        resetAt: () => new Date().toISOString(),
      } as any,
      { assertTopicAccess: async () => undefined, lockedTopics: async () => [] } as any,
      { recommendedByTopic: async () => new Map([['ml-basics', 'hard']]) } as any,
    );
    const q = await service.next('u1', 'pro', {});
    expect(q.adaptive).toBe(false);
    expect((pipelines[1][0] as any).$match.$or).toBeUndefined();
  });
});
