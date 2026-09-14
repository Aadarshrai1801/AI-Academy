import { rankHardQuestions, type HardQuestionCandidate } from './hardest-questions.js';

const q = (over: Partial<HardQuestionCandidate> & { questionId: string }): HardQuestionCandidate => ({
  topic: 'llms',
  difficulty: 'hard',
  day: '2026-09-14',
  attemptCount: 1,
  correctCount: 0,
  ...over,
});

describe('rankHardQuestions', () => {
  it('orders hard before medium before easy regardless of volume', () => {
    const ranked = rankHardQuestions([
      q({ questionId: 'e1', difficulty: 'easy', attemptCount: 99 }),
      q({ questionId: 'm1', difficulty: 'medium', attemptCount: 5 }),
      q({ questionId: 'h1', difficulty: 'hard', attemptCount: 1 }),
    ]);
    expect(ranked.map((r) => r.questionId)).toEqual(['h1', 'm1', 'e1']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks difficulty ties by attempt volume, then id', () => {
    const ranked = rankHardQuestions([
      q({ questionId: 'h-low', attemptCount: 2 }),
      q({ questionId: 'h-high', attemptCount: 40 }),
      q({ questionId: 'h-mid', attemptCount: 10 }),
    ]);
    expect(ranked.map((r) => r.questionId)).toEqual(['h-high', 'h-mid', 'h-low']);

    const tie = rankHardQuestions([
      q({ questionId: 'b', attemptCount: 3 }),
      q({ questionId: 'a', attemptCount: 3 }),
    ]);
    expect(tie.map((r) => r.questionId)).toEqual(['a', 'b']);
  });

  it('computes accuracy and clamps to the requested limit', () => {
    const ranked = rankHardQuestions(
      [q({ questionId: 'h1', attemptCount: 4, correctCount: 1 }), q({ questionId: 'h2' })],
      1,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].accuracy).toBe(0.25);
  });

  it('never divides by zero', () => {
    const ranked = rankHardQuestions([q({ questionId: 'h1', attemptCount: 0, correctCount: 0 })]);
    expect(ranked[0].accuracy).toBeNull();
  });

  it('does not mutate the input array', () => {
    const input = [q({ questionId: 'a', difficulty: 'easy' }), q({ questionId: 'b' })];
    rankHardQuestions(input);
    expect(input.map((r) => r.questionId)).toEqual(['a', 'b']);
  });
});
