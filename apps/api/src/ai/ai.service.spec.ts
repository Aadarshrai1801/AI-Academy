import { HttpException } from '@nestjs/common';
import { AiService } from './ai.service.js';
import type { LlmProvider } from '../llm/llm.provider.js';

/**
 * "Explain my mistake" contract:
 * - mistake cache hits are free and never touch the LLM or quota;
 * - misses consume exactly one ai_text unit and refund on failure;
 * - the mistake cache is separate from the pure-Q&A canonical cache.
 */

function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

function makeService(opts: { mistakeHit?: Record<string, unknown> | null; llm?: Partial<LlmProvider> | null } = {}) {
  const queryCreates: any[] = [];
  const mistakeCreates: any[] = [];
  const queries = {
    create: async (doc: any) => {
      queryCreates.push(doc);
      return { ...doc, _id: 'q1' };
    },
    countDocuments: () => chain(0),
  };
  const canonicals = {
    findOne: () => chain(null),
    find: () => chain([]),
    create: async (doc: any) => ({ ...doc, _id: 'c1' }),
    countDocuments: () => chain(0),
  };
  const hit = opts.mistakeHit
    ? {
        ...opts.mistakeHit,
        save: vi.fn(async () => undefined),
      }
    : null;
  const mistakes = {
    findOne: () => chain(hit),
    create: async (doc: any) => {
      mistakeCreates.push(doc);
      return { ...doc, _id: 'm1' };
    },
    countDocuments: () => chain(0),
  };
  const consumeSpy = vi.fn(async () => undefined);
  const refundSpy = vi.fn(async () => undefined);
  const entitlements = {
    consumeOrThrow: consumeSpy,
    refund: refundSpy,
    check: async () => ({ allowed: true, remaining: 4, limit: 5 }),
  };
  const youtube = { recommendations: async () => null, configured: false };
  const llm =
    opts.llm === null
      ? undefined
      : {
          name: 'mock-llm',
          explainMistake: vi.fn(async () => ({ onTopic: true, answer: '**Why you missed it**' })),
          answerQuestion: vi.fn(async () => ({ onTopic: true, answer: 'x' })),
          generateQuestions: vi.fn(async () => []),
          buildScript: vi.fn(async () => ({ title: 't', scenes: [] })),
          ...opts.llm,
        };
  const service = new AiService(
    queries as any,
    canonicals as any,
    mistakes as any,
    entitlements as any,
    youtube as any,
    llm as any,
  );
  return { service, queryCreates, mistakeCreates, hit, consumeSpy, refundSpy, llm };
}

const base = {
  question: 'Why is cross-validation used instead of a single split?',
  userAnswer: 'to train faster',
  correctAnswer: 'for a more robust performance estimate',
  explanation: 'Averaging over folds reduces variance.',
};

describe('AiService.explainMistake — cache separation', () => {
  it('serves a cache hit for free without calling the LLM', async () => {
    const { service, hit, consumeSpy, llm } = makeService({
      mistakeHit: { text_answer: 'cached diagnosis', times_reused: 2 },
    });
    const res = await service.explainMistake('u1', 'free', base);
    expect(res.answer).toBe('cached diagnosis');
    expect(res.cached).toBe(true);
    expect(res.kind).toBe('explain');
    expect((hit as unknown as { times_reused: number }).times_reused).toBe(3);
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(llm!.explainMistake).not.toHaveBeenCalled();
  });

  it('consumes quota and writes the mistake cache on a miss', async () => {
    const { service, mistakeCreates, consumeSpy, refundSpy, llm } = makeService();
    const res = await service.explainMistake('u1', 'pro', base);
    expect(res.cached).toBe(false);
    expect(res.answer).toBe('**Why you missed it**');
    expect(consumeSpy).toHaveBeenCalledWith('u1', 'pro', 'ai_text');
    expect(refundSpy).not.toHaveBeenCalled();
    expect(llm!.explainMistake).toHaveBeenCalledWith({
      question: base.question,
      userAnswer: base.userAnswer,
      correctAnswer: base.correctAnswer,
      explanation: base.explanation,
    });
    expect(mistakeCreates).toHaveLength(1);
    // Keyed by the normalized question + wrong answer pair.
    expect(mistakeCreates[0].normalized_wrong_answer).toBe('to train faster');
    expect((res as { quota?: { remaining: number; limit: number } }).quota).toMatchObject({
      remaining: 4,
      limit: 5,
    });
  });

  it('refunds and 503s when no LLM provider is configured', async () => {
    const { service, refundSpy } = makeService({ llm: null });
    await expect(service.explainMistake('u1', 'free', base)).rejects.toMatchObject({ status: 503 });
    expect(refundSpy).toHaveBeenCalledWith('u1', 'ai_text');
  });

  it('refunds when the provider fails', async () => {
    const { service, refundSpy } = makeService({
      llm: {
        explainMistake: vi.fn(async () => {
          throw new Error('groq down');
        }),
      },
    });
    await expect(service.explainMistake('u1', 'free', base)).rejects.toThrow('groq down');
    expect(refundSpy).toHaveBeenCalledWith('u1', 'ai_text');
  });

  it('refunds an off-topic verdict and logs the query', async () => {
    const { service, refundSpy, queryCreates } = makeService({
      llm: { explainMistake: vi.fn(async () => ({ onTopic: false, answer: '' })) },
    });
    await expect(service.explainMistake('u1', 'free', base)).rejects.toBeInstanceOf(HttpException);
    expect(refundSpy).toHaveBeenCalledWith('u1', 'ai_text');
    expect(queryCreates.at(-1)).toMatchObject({ kind: 'explain', cached: false, text_answer: '' });
  });

  it('rejects malformed input before spending quota', async () => {
    const { service, consumeSpy } = makeService();
    await expect(
      service.explainMistake('u1', 'free', { ...base, userAnswer: '   ' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.explainMistake('u1', 'free', { ...base, question: 'hi' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(consumeSpy).not.toHaveBeenCalled();
  });
});
