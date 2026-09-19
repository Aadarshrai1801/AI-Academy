import { HttpException, HttpStatus } from '@nestjs/common';
import { CurriculumService } from './curriculum.service.js';
import { TOPIC_GRAPH, TOPIC_IDS, prerequisitesOf } from './curriculum.js';

/**
 * Learning-path gate: static graph validity + the consecutive-correct rule.
 * The graph is the contract the web skill tree renders; a cycle or an unknown
 * prerequisite would silently lock (or unlock) the wrong topics.
 */

/** Minimal chainable Mongoose query stub: every method returns the chain. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

const MAX = 3;

function makeService(rowsByTopic: Record<string, Array<{ is_correct: boolean }>>) {
  const attempts = {
    find: (filter: { topic: string }) => chain((rowsByTopic[filter.topic] ?? []).slice(0, MAX)),
  };
  const questions = { aggregate: () => chain([]) };
  return new CurriculumService(attempts as any, questions as any);
}

function correct(n: number) {
  return Array.from({ length: n }, () => ({ is_correct: true }));
}

describe('curriculum graph — static contract', () => {
  it('covers every topic id exactly once', () => {
    expect(TOPIC_GRAPH.map((n) => n.id).sort()).toEqual([...TOPIC_IDS].sort());
  });

  it('references only known topics and never itself', () => {
    const known = new Set<string>(TOPIC_IDS);
    for (const node of TOPIC_GRAPH) {
      for (const p of node.prerequisiteTopicIds) {
        expect(known.has(p)).toBe(true);
        expect(p).not.toBe(node.id);
      }
    }
  });

  it('is acyclic', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      expect(visiting.has(id)).toBe(false);
      visiting.add(id);
      for (const p of prerequisitesOf(id as (typeof TOPIC_IDS)[number])) visit(p);
      visiting.delete(id);
      done.add(id);
    };
    for (const node of TOPIC_GRAPH) visit(node.id);
    expect(done.size).toBe(TOPIC_GRAPH.length);
  });

  it('is topologically sorted (prerequisites precede dependants)', () => {
    const seen = new Set<string>();
    for (const node of TOPIC_GRAPH) {
      for (const p of node.prerequisiteTopicIds) expect(seen.has(p)).toBe(true);
      seen.add(node.id);
    }
  });

  it('keeps the foundation topics ungated', () => {
    expect(prerequisitesOf('ml-basics')).toEqual([]);
    expect(prerequisitesOf('statistics')).toEqual([]);
  });
});

describe('CurriculumService — consecutive-correct mastery', () => {
  it('counts a clean tail run', async () => {
    const service = makeService({ 'ml-basics': correct(3) });
    await expect(service.consecutiveCorrect('u1', 'ml-basics')).resolves.toBe(3);
  });

  it('breaks on the first wrong answer in the tail', async () => {
    // Rows arrive newest-first: a wrong answer at the head resets the run.
    const service = makeService({
      'ml-basics': [{ is_correct: false }, { is_correct: true }, { is_correct: true }],
    });
    await expect(service.consecutiveCorrect('u1', 'ml-basics')).resolves.toBe(0);
  });

  it('counts the clean run before an older miss', async () => {
    const service = makeService({
      'ml-basics': [{ is_correct: true }, { is_correct: true }, { is_correct: false }],
    });
    await expect(service.consecutiveCorrect('u1', 'ml-basics')).resolves.toBe(2);
  });

  it('reports an empty history as zero', async () => {
    const service = makeService({});
    await expect(service.consecutiveCorrect('u1', 'llms')).resolves.toBe(0);
  });

  it('derives lock status from prerequisite mastery', async () => {
    const service = makeService({
      'ml-basics': correct(3),
      statistics: correct(3),
    });
    const states = await service.topicStates('u1');
    expect(states.get('ml-basics')!.status).toBe('mastered');
    expect(states.get('neural-networks')!.status).toBe('unlocked');
    expect(states.get('deep-learning')!.status).toBe('locked');
    expect(states.get('llms')!.status).toBe('locked');
    await expect(service.lockedTopics('u1', 'free')).resolves.toEqual(
      expect.arrayContaining(['deep-learning', 'llms']),
    );
  });

  it('marks a partially-progressed unlocked topic in_progress', async () => {
    const service = makeService({ 'ml-basics': correct(3), statistics: correct(3) });
    // neural-networks has no attempts yet; give it one correct tail run.
    (service as any).attempts = {
      find: (filter: { topic: string }) =>
        chain(filter.topic === 'neural-networks' ? correct(1) : correct(3)),
    };
    const states = await service.topicStates('u1');
    expect(states.get('neural-networks')!.status).toBe('in_progress');
  });

  it('exempts admins and disabled gates from locking', async () => {
    const service = makeService({});
    await expect(service.lockedTopics('u1', 'admin')).resolves.toEqual([]);

    const saved = process.env.TOPIC_GATE_ENABLED;
    process.env.TOPIC_GATE_ENABLED = 'false';
    try {
      await expect(service.lockedTopics('u1', 'free')).resolves.toEqual([]);
    } finally {
      if (saved === undefined) delete process.env.TOPIC_GATE_ENABLED;
      else process.env.TOPIC_GATE_ENABLED = saved;
    }
  });

  it('throws an actionable 403 for a locked topic and passes foundations', async () => {
    const service = makeService({});
    const err = await service.assertTopicAccess('u1', 'free', 'llms').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect((err as HttpException).getResponse()).toMatchObject({ feature: 'topic_locked' });
    await expect(service.assertTopicAccess('u1', 'free', 'ml-basics')).resolves.toBeUndefined();
    await expect(service.assertTopicAccess('u1', 'free', 'not-a-topic')).resolves.toBeUndefined();
    await expect(service.assertTopicAccess('u1', 'admin', 'llms')).resolves.toBeUndefined();
  });

  it('returns the DAG with per-learner statuses', async () => {
    const service = makeService({ 'ml-basics': correct(3), statistics: correct(3) });
    const graph = await service.graphFor('u1');
    expect(graph.nodes).toHaveLength(TOPIC_GRAPH.length);
    expect(graph.gate.enabled).toBe(true);
    expect(graph.gate.consecutiveCorrectRequired).toBe(3);
    const llms = graph.nodes.find((n) => n.id === 'llms')!;
    expect(llms.prerequisiteTopicIds).toEqual(['deep-learning']);
    expect(llms.status).toBe('locked');
  });

  it('surfaces the prerequisite detail on the 403 payload', async () => {
    const service = makeService({ 'ml-basics': correct(3) });
    try {
      await service.assertTopicAccess('u1', 'free', 'neural-networks');
      throw new Error('expected rejection');
    } catch (err) {
      const payload = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(payload.feature).toBe('topic_locked');
      expect(payload.required).toBe(3);
      expect(payload.prerequisites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ topic: 'ml-basics', mastered: true }),
          expect.objectContaining({ topic: 'statistics', mastered: false }),
        ]),
      );
    }
  });
});
