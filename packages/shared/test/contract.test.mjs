/**
 * Contract tests for the shared domain rules (points, grading, quotas, keys).
 *
 * These run against the built `dist/` output with node:test — no extra
 * dependencies — and act as the guardrail for the API/web/mobile copies of
 * the same rules: change a number here and CI fails until every consumer is
 * updated (or until the API imports this package directly).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_POINTS,
  QUOTAS,
  SHARED_PACKAGE_VERSION,
  STREAK_QUALIFYING_ATTEMPTS,
  TOPIC_GRAPH,
  TOPIC_MASTERY_CONSECUTIVE_CORRECT,
  TOPICS,
  dailyBoardKey,
  dailyQuotaKey,
  dayBucket,
  gradeAnswer,
  monthBucket,
  monthlyQuotaKey,
  pointsForAttempt,
  prerequisitesOf,
} from '../dist/index.js';

test('base points are the agreed difficulty table', () => {
  assert.deepEqual(BASE_POINTS, { easy: 10, medium: 25, hard: 50 });
});

test('fast correct answers get the 1.5x multiplier (rounded)', () => {
  assert.equal(pointsForAttempt({ difficulty: 'easy', timeTakenMs: 10_000, isCorrect: true }), 15);
  assert.equal(pointsForAttempt({ difficulty: 'medium', timeTakenMs: 29_999, isCorrect: true }), 38);
  assert.equal(pointsForAttempt({ difficulty: 'hard', timeTakenMs: 30_000, isCorrect: true }), 75);
});

test('slow correct answers get base points, wrong answers get zero', () => {
  assert.equal(pointsForAttempt({ difficulty: 'hard', timeTakenMs: 30_001, isCorrect: true }), 50);
  assert.equal(pointsForAttempt({ difficulty: 'hard', timeTakenMs: 1_000, isCorrect: false }), 0);
});

test('custom thresholds/multipliers are honored', () => {
  assert.equal(
    pointsForAttempt({
      difficulty: 'medium',
      timeTakenMs: 5_000,
      isCorrect: true,
      fastThresholdMs: 10_000,
      fastMultiplier: 2,
    }),
    50,
  );
});

test('mcq grading is normalized exact match', () => {
  assert.equal(gradeAnswer('mcq', '  Backpropagation ', 'backpropagation'), true);
  assert.equal(gradeAnswer('mcq', 'Gradient descent', 'gradient   descent'), true);
  assert.equal(gradeAnswer('mcq', 'Gradient descent', 'adam'), false);
});

test('short answers use normalized containment but reject empty input', () => {
  assert.equal(gradeAnswer('short_answer', 'vanishing gradients', 'vanishing gradient'), true);
  assert.equal(gradeAnswer('code', 'np.dot(a, b)', 'dot'), true);
  assert.equal(gradeAnswer('short_answer', 'attention', ''), false);
  assert.equal(gradeAnswer('short_answer', 'attention', '   '), false);
});

test('quota table keeps the free/pro contract stable', () => {
  assert.equal(QUOTAS.free.practiceQuestionsPerDay, 10);
  assert.equal(QUOTAS.free.hardQuestionsPerDay, 2);
  assert.equal(QUOTAS.free.aiVideosPerMonth, 2);
  assert.equal(QUOTAS.free.aiVideoNovelAllowed, false);
  assert.equal(QUOTAS.free.callMinutesCap, 15);
  assert.equal(QUOTAS.pro.practiceQuestionsPerDay, -1);
  assert.equal(QUOTAS.pro.aiVideoNovelAllowed, true);
  assert.equal(QUOTAS.admin.practiceSoftCapPerDay, 10_000);
});

test('quota keys and buckets are stable', () => {
  const d = new Date('2026-01-02T03:04:05Z');
  assert.equal(dayBucket(d), '2026-01-02');
  assert.equal(monthBucket(d), '2026-01');
  assert.equal(dailyQuotaKey('u1', '2026-01-02', 'practice_questions'), 'quota:u1:2026-01-02:practice_questions');
  assert.equal(monthlyQuotaKey('u1', '2026-01', 'ai_video'), 'quota:u1:2026-01:ai_video');
  assert.equal(dailyBoardKey('2026-01-02'), 'lb:daily:2026-01-02');
});

test('topics and streak threshold stay in sync with the product spec', () => {
  assert.deepEqual(TOPICS, [
    'ml-basics',
    'statistics',
    'neural-networks',
    'deep-learning',
    'llms',
    'evaluation',
  ]);
  assert.equal(STREAK_QUALIFYING_ATTEMPTS, 1);
});

test('the prerequisite graph is a valid DAG over the known topics', () => {
  const known = new Set(TOPICS);
  assert.equal(TOPIC_GRAPH.length, TOPICS.length);
  assert.deepEqual(
    TOPIC_GRAPH.map((n) => n.id).sort(),
    [...TOPICS].sort(),
  );
  for (const node of TOPIC_GRAPH) {
    for (const p of node.prerequisiteTopicIds) {
      assert.ok(known.has(p), `${node.id} references unknown prerequisite ${p}`);
      assert.notEqual(p, node.id, `${node.id} cannot require itself`);
    }
  }
  // Acyclic + topologically sorted: prerequisites must appear earlier.
  const seen = new Set();
  for (const node of TOPIC_GRAPH) {
    for (const p of node.prerequisiteTopicIds) {
      assert.ok(seen.has(p), `${p} must precede ${node.id} in TOPIC_GRAPH`);
    }
    seen.add(node.id);
  }
  assert.deepEqual(prerequisitesOf('ml-basics'), []);
  assert.deepEqual(prerequisitesOf('llms'), ['deep-learning']);
  assert.equal(TOPIC_MASTERY_CONSECUTIVE_CORRECT, 3);
});

test('built artefact exposes a version marker for skew detection', () => {
  // If this is undefined, dist/ is stale (build runs in pretest).
  assert.equal(typeof SHARED_PACKAGE_VERSION, 'string');
  assert.match(SHARED_PACKAGE_VERSION, /^\d+\.\d+\.\d+$/);
});
