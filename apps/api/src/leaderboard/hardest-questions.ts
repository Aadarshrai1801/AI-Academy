/**
 * Ranking for the daily hardest-questions board.
 *
 * Kept as a pure function so the ordering contract is unit-testable without a
 * database: hard → medium → easy, then attempt volume, then question id for
 * deterministic ties. MongoDB's `$switch`/`$cond` would need a `then` key
 * (lint-reserved word) and would still only cover one engine.
 */
export interface HardQuestionCandidate {
  questionId: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  day: string;
  attemptCount: number;
  correctCount: number;
}

export interface HardQuestionRow extends HardQuestionCandidate {
  rank: number;
  accuracy: number | null;
}

/**
 * FNV-1a 32-bit hash — deterministic daily seed ("YYYY-MM-DD" → uint32).
 * Exported for tests.
 */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Slice a hardness-ordered pool into the day's fixed gauntlet set: rotate by
 * the day seed and take `limit` (capped at 10). Same pool + same day always
 * yields the same ranked 10; a new day yields a new slice. Pure for tests.
 */
export function gauntletSlice<T extends HardQuestionCandidate>(
  ordered: T[],
  day: string,
  limit = 10,
): Array<T & { rank: number; accuracy: number | null }> {
  const n = Math.min(Math.max(limit, 1), 10);
  if (ordered.length === 0 || n <= 0) return [];
  const offset = daySeed(day) % ordered.length;
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  return rotated.slice(0, Math.min(n, ordered.length)).map((c, i) => ({
    ...c,
    rank: i + 1,
    accuracy: c.attemptCount > 0 ? c.correctCount / c.attemptCount : null,
  }));
}

const DIFFICULTY_RANK: Record<string, number> = { hard: 3, medium: 2, easy: 1 };

export function rankHardQuestions(
  candidates: HardQuestionCandidate[],
  limit = 10,
): HardQuestionRow[] {
  return [...candidates]
    .sort((a, b) => {
      const byDifficulty = (DIFFICULTY_RANK[b.difficulty] ?? 0) - (DIFFICULTY_RANK[a.difficulty] ?? 0);
      if (byDifficulty !== 0) return byDifficulty;
      if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
      return a.questionId.localeCompare(b.questionId);
    })
    .slice(0, Math.max(limit, 0))
    .map((c, i) => ({
      ...c,
      rank: i + 1,
      accuracy: c.attemptCount > 0 ? c.correctCount / c.attemptCount : null,
    }));
}
