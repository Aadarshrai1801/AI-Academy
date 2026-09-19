import { SEED_QUESTIONS } from './seed.data.js';

/**
 * The seed bank is the only guaranteed question supply on a fresh install.
 * Phase 1 requires every row to carry a valid topic + difficulty tag so the
 * learning-path gate and adaptive difficulty can bucket it.
 */
describe('seed bank tagging', () => {
  const TOPICS = ['ml-basics', 'statistics', 'neural-networks', 'deep-learning', 'llms', 'evaluation'];
  const DIFFICULTIES = ['easy', 'medium', 'hard'];

  it('ships exactly 54 questions (6 topics × 3 difficulties × 3)', () => {
    expect(SEED_QUESTIONS).toHaveLength(54);
  });

  it('tags every question with a known topic and difficulty', () => {
    for (const q of SEED_QUESTIONS) {
      expect(TOPICS).toContain(q.topic);
      expect(DIFFICULTIES).toContain(q.difficulty);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.correct_answer.length).toBeGreaterThan(0);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it('keeps a 3-per-topic-per-difficulty matrix', () => {
    const counts = new Map<string, number>();
    for (const q of SEED_QUESTIONS) {
      const key = `${q.topic}/${q.difficulty}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const topic of TOPICS) {
      for (const difficulty of DIFFICULTIES) {
        expect(counts.get(`${topic}/${difficulty}`)).toBe(3);
      }
    }
  });

  it('only uses mcq/short_answer/code types and unique prompts', () => {
    const seen = new Set<string>();
    for (const q of SEED_QUESTIONS) {
      expect(['mcq', 'short_answer', 'code']).toContain(q.type);
      expect(seen.has(q.prompt)).toBe(false);
      seen.add(q.prompt);
      if (q.type === 'mcq') {
        expect(q.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(q.options).toContain(q.correct_answer);
      }
    }
  });
});
