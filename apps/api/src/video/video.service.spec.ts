import { VideoService, SEQUENCE_MAX } from './video.service.js';

/**
 * Phase 10 playlist sequencing: topic requests get the next free slot (0..4),
 * canonical reuse can tag an untagged ready video once, and playlists/checks
 * are topic-scoped. Budget/quota behavior is unchanged and covered elsewhere.
 */

function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

function canonDoc() {
  return {
    _id: 'c1',
    canonical_text: 'What is attention?',
    text_answer: 'Attention weights tokens.',
    video_status: 'none',
    times_reused: 0,
    save: vi.fn(async () => undefined),
  };
}

function makeService(
  opts: {
    ready?: Record<string, unknown> | null;
    usedSlots?: number[];
    sampleForTopic?: any;
    jobById?: Record<string, unknown> | null;
  } = {},
) {
  const created: any[] = [];
  const jobs = {
    findOne: () => chain(opts.ready ?? null),
    findById: () => chain(opts.jobById ?? null),
    find: () => chain((opts.usedSlots ?? []).map((sequence_index) => ({ sequence_index }))),
    create: async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: `job${created.length}` };
    },
    countDocuments: () => chain(0),
  };
  const canonicals = { findById: () => chain(canonDoc()) };
  const queries = { findOne: () => chain(null) };
  const entitlementCalls: string[] = [];
  const entitlements = {
    consumeOrThrow: async (_u: string, _r: string, feature: string) => {
      entitlementCalls.push(feature);
    },
    refund: async () => undefined,
    check: async () => ({ allowed: true, remaining: 1, limit: 2 }),
  };
  const redis = { incr: async () => 1, expire: async () => 1, decr: async () => 0 };
  const questions = {
    sampleForTopic: vi.fn(
      opts.sampleForTopic ??
        (async () => [
          { id: 'q1', topic: 'llms', difficulty: 'easy', type: 'mcq', prompt: 'Q1', options: ['a', 'b'] },
        ]),
    ),
  };
  const service = new VideoService(
    jobs as any,
    canonicals as any,
    queries as any,
    entitlements as any,
    redis as any,
    null as any,
    { name: 'noop', synthesize: async () => ({ audioPath: null, durationSec: 1 }) } as any,
    questions as any,
  );
  // In-process queue: no Redis/BullMQ in unit tests.
  (service as any).queue = { add: vi.fn(async () => undefined) };
  return { service, created, questions, entitlementCalls };
}

describe('VideoService — topic playlist sequencing', () => {
  it('assigns the next free sequence slot to a new topic render', async () => {
    const { service, created } = makeService({ usedSlots: [0, 2] });
    const res = await service.request('u1', 'pro', { canonicalId: '64abb71ab5f7e9688774dc33', topicId: 'llms' });
    expect(res).toMatchObject({ cached: false, topicId: 'llms', sequenceIndex: 1 });
    expect(created[0]).toMatchObject({ topic_id: 'llms', sequence_index: 1 });
  });

  it('leaves a render standalone when the topic playlist is full', async () => {
    const { service, created } = makeService({
      usedSlots: Array.from({ length: SEQUENCE_MAX }, (_, i) => i),
    });
    const res = await service.request('u1', 'pro', { canonicalId: '64abb71ab5f7e9688774dc33', topicId: 'llms' });
    expect(res).toMatchObject({ topicId: null, sequenceIndex: null });
    expect(created[0].topic_id).toBeUndefined();
    expect(created[0].sequence_index).toBeUndefined();
  });

  it('rejects an unknown topic id before spending quota', async () => {
    const { service, entitlementCalls } = makeService();
    await expect(
      service.request('u1', 'pro', { canonicalId: '64abb71ab5f7e9688774dc33', topicId: 'astrology' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(entitlementCalls).toEqual([]);
  });

  it('tags an untagged ready video into the playlist on canonical reuse', async () => {
    const ready = {
      _id: 'job9',
      status: 'ready',
      topic_id: undefined,
      sequence_index: undefined,
      save: vi.fn(async () => undefined),
    };
    const { service } = makeService({ ready, usedSlots: [0] });
    const res = await service.request('u1', 'free', { canonicalId: '64abb71ab5f7e9688774dc33', topicId: 'llms' });
    expect(res).toMatchObject({ cached: true, topicId: 'llms', sequenceIndex: 1 });
    expect(ready.save).toHaveBeenCalled();
  });

  it('does not re-tag a video that already belongs to a topic', async () => {
    const ready = {
      _id: 'job9',
      status: 'ready',
      topic_id: 'ml-basics',
      sequence_index: 0,
      save: vi.fn(async () => undefined),
    };
    const { service } = makeService({ ready, usedSlots: [0] });
    const res = await service.request('u1', 'free', { canonicalId: '64abb71ab5f7e9688774dc33', topicId: 'llms' });
    expect(res).toMatchObject({ topicId: 'ml-basics', sequenceIndex: 0 });
    expect(ready.save).not.toHaveBeenCalled();
  });
});

describe('VideoService — sequence + check endpoints', () => {
  it('rejects unknown topics on the playlist endpoint', async () => {
    const { service } = makeService();
    await expect(service.sequence('nope')).rejects.toMatchObject({ status: 400 });
  });

  it('delegates check questions to the questions module (capped at 1-2)', async () => {
    const { service, questions } = makeService({
      sampleForTopic: async () => [
        { id: 'q1', topic: 'llms', difficulty: 'easy', type: 'mcq', prompt: 'Q1' },
        { id: 'q2', topic: 'llms', difficulty: 'medium', type: 'short_answer', prompt: 'Q2' },
      ],
    });
    const res = await service.checkQuestions('u1', 'free', 'llms', 9);
    expect(questions.sampleForTopic).toHaveBeenCalledWith('u1', 'free', 'llms', 2);
    expect(res.topicId).toBe('llms');
    expect(res.items).toHaveLength(2);
  });

  it('rejects unknown topics on the check endpoint', async () => {
    const { service } = makeService();
    await expect(service.checkQuestions('u1', 'free', 'nope')).rejects.toMatchObject({ status: 400 });
  });
});

describe('VideoService — cached playback is never ownership-gated (Phase 12)', () => {
  const JOB_ID = '64abb71ab5f7e9688774dc33';

  it('lets any tier open a ready cached video rendered by someone else', async () => {
    const { service } = makeService({
      jobById: {
        _id: 'j1',
        status: 'ready',
        user_id: 'owner',
        video_url: 'https://cdn.example.com/v.mp4',
        created_at: new Date(),
      },
    });
    const res = await service.status('other', 'free', JOB_ID);
    expect(res.status).toBe('ready');
    expect(res.fileToken).not.toBeNull();
  });

  it('keeps in-flight jobs owner-only (admins excepted)', async () => {
    const { service } = makeService({
      jobById: { _id: 'j1', status: 'generating', user_id: 'owner', progress: 30 },
    });
    await expect(service.status('other', 'free', JOB_ID)).rejects.toMatchObject({ status: 403 });
    await expect(service.status('owner', 'free', JOB_ID)).resolves.toMatchObject({ status: 'generating' });
    await expect(service.status('other', 'admin', JOB_ID)).resolves.toMatchObject({ status: 'generating' });
  });

  it('404s unknown jobs and 400s malformed ids', async () => {
    const { service } = makeService({ jobById: null });
    await expect(service.status('u', 'free', JOB_ID)).rejects.toMatchObject({ status: 404 });
    await expect(service.status('u', 'free', 'nope')).rejects.toMatchObject({ status: 400 });
  });
});
