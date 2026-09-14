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
