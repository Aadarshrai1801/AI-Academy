import { MessagesService } from './messages.service.js';

/**
 * Study-mode missed-question feed: posts once per (group, member, question)
 * within the dedupe window using the normal chat message schema/transport.
 */

function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

const G1 = '64abb71ab5f7e9688774dc31';
const G2 = '64abb71ab5f7e9688774dc32';

function makeService(opts: { existing?: unknown; groupIds?: string[] } = {}) {
  const created: any[] = [];
  const messages = {
    findOne: () => chain(opts.existing ?? null),
    create: async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: `m${created.length}` };
    },
  };
  const groups = {
    studyGroupIdsFor: vi.fn(async () => opts.groupIds ?? [G1]),
  };
  const service = new MessagesService(messages as any, groups as any, {} as any, null);
  return { service, created, groups };
}

const miss = {
  questionId: '64abb71ab5f7e9688774dc33',
  topic: 'ml-basics',
  difficulty: 'medium',
  prompt: 'Why is the validation loss rising?',
};

describe('MessagesService.publishMissedQuestion', () => {
  it('posts a study_prompt to every study group the member belongs to', async () => {
    const { service, created } = makeService({ groupIds: [G1, G2] });
    const posted = await service.publishMissedQuestion('u1', miss);
    expect(posted).toBe(2);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      sender_id: 'u1',
      type: 'study_prompt',
      content: miss.prompt,
      read_by: ['u1'],
    });
    expect(String(created[0].question_id)).toBe(miss.questionId);
  });

  it('dedupes repeats inside the window', async () => {
    const { service, created } = makeService({ existing: { _id: 'old' } });
    const posted = await service.publishMissedQuestion('u1', miss);
    expect(posted).toBe(0);
    expect(created).toHaveLength(0);
  });

  it('does nothing when the member has no study groups', async () => {
    const { service, created } = makeService({ groupIds: [] });
    await expect(service.publishMissedQuestion('u1', miss)).resolves.toBe(0);
    expect(created).toHaveLength(0);
  });

  it('rejects malformed question ids without querying groups', async () => {
    const { service, groups } = makeService();
    await expect(
      service.publishMissedQuestion('u1', { ...miss, questionId: 'not-an-id' }),
    ).resolves.toBe(0);
    expect(groups.studyGroupIdsFor).not.toHaveBeenCalled();
  });
});
