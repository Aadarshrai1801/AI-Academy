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
 *
 * Round-robins across topics so the daily set spans categories instead of
 * letting one dominant topic (e.g. a freshly seeded bank) fill all 10 slots.
 * Within each topic the hardness order is preserved, and ranks are assigned
 * after interleaving.
 */
export function gauntletSlice<T extends HardQuestionCandidate>(
  ordered: T[],
  day: string,
  limit = 10,
): Array<T & { rank: number; accuracy: number | null }> {
  const n = Math.min(Math.max(limit, 1), 10);
  if (ordered.length === 0 || n <= 0) return [];

  // Group by topic, preserving the incoming hardness order within each group.
  const byTopic = new Map<string, T[]>();
  for (const candidate of ordered) {
    const group = byTopic.get(candidate.topic);
    if (group) group.push(candidate);
    else byTopic.set(candidate.topic, [candidate]);
  }

  // Rotate the topic order by the day seed so the lead category varies daily.
  const topics = [...byTopic.keys()];
  const offset = daySeed(day) % topics.length;
  const rotatedTopics = [...topics.slice(offset), ...topics.slice(0, offset)];

  // Deal one question per topic per round until the set is full.
  const picked: T[] = [];
  const queues = rotatedTopics.map((topic) => byTopic.get(topic)!);
  let progress = true;
  while (picked.length < Math.min(n, ordered.length) && progress) {
    progress = false;
    for (const queue of queues) {
      if (picked.length >= Math.min(n, ordered.length)) break;
      const next = queue.shift();
      if (next) {
        picked.push(next);
        progress = true;
      }
    }
  }

  return picked.map((c, i) => ({
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
