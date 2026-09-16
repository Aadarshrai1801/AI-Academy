import { daySeed, gauntletSlice, rankHardQuestions, type HardQuestionCandidate } from './hardest-questions.js';

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

describe('daySeed', () => {
  it('is deterministic per day and a uint32', () => {
    expect(daySeed('2026-09-16')).toBe(daySeed('2026-09-16'));
    const seed = daySeed('2026-09-16');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('differs across days', () => {
    expect(daySeed('2026-09-16')).not.toBe(daySeed('2026-09-17'));
  });
});

describe('gauntletSlice', () => {
  const pool = (n: number): HardQuestionCandidate[] =>
    Array.from({ length: n }, (_, i) => q({ questionId: `q${i.toString().padStart(2, '0')}` }));

  it('returns the same ranked slice for the same day', () => {
    const a = gauntletSlice(pool(25), '2026-09-16');
    const b = gauntletSlice(pool(25), '2026-09-16');
    expect(a.map((r) => r.questionId)).toEqual(b.map((r) => r.questionId));
    expect(a.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('caps at 10 and handles pools smaller than the limit', () => {
    expect(gauntletSlice(pool(25), '2026-09-16')).toHaveLength(10);
    const small = gauntletSlice(pool(3), '2026-09-16');
    expect(small).toHaveLength(3);
    expect(small.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(gauntletSlice([], '2026-09-16')).toEqual([]);
  });

  it('computes accuracy like the board contract', () => {
    const rows = gauntletSlice(
      [
        q({ questionId: 'a', attemptCount: 4, correctCount: 1 }),
        q({ questionId: 'b', attemptCount: 0, correctCount: 0 }),
      ],
      '2026-09-16',
      10,
    );
    expect(rows.find((r) => r.questionId === 'a')?.accuracy).toBe(0.25);
    expect(rows.find((r) => r.questionId === 'b')?.accuracy).toBeNull();
  });
});
