// Single source of truth for roles, quotas, and points logic (spec §1, §2.1, §6).
// Both apps/web (display) and apps/api (enforcement) mirror these values.
// API keeps its own copy at runtime to avoid cross-workspace imports in Phase 0.

export type Role = "free" | "pro" | "admin";
export type Difficulty = "easy" | "medium" | "hard";

export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
};

/** Speed bonus: answered within threshold gets multiplier, capped to prevent gaming. */
export function pointsForAttempt(args: {
  difficulty: Difficulty;
  timeTakenMs: number;
  isCorrect: boolean;
  fastThresholdMs?: number;
  fastMultiplier?: number;
}): number {
  if (!args.isCorrect) return 0;
  const base = BASE_POINTS[args.difficulty];
  const threshold = args.fastThresholdMs ?? 30_000;
  const mult = args.timeTakenMs <= threshold ? (args.fastMultiplier ?? 1.5) : 1;
  return Math.round(base * mult);
}

export interface TierQuota {
  practiceQuestionsPerDay: number; // -1 = unlimited (soft cap enforced separately)
  practiceSoftCapPerDay: number;
  hardQuestionsPerDay: number; // -1 = full access
  aiTextPerDay: number;
  aiVideosPerMonth: number;
  aiVideoNovelAllowed: boolean;
  groupsOwned: number; // -1 = unlimited
  groupMembers: number;
  callType: "1:1" | "group";
  callMinutesCap: number; // -1 = fair-use soft cap
  screenShare: boolean;
  leaderboard: "own-only" | "full";
}

export const QUOTAS: Record<Role, TierQuota> = {
  free: {
    practiceQuestionsPerDay: 10,
    practiceSoftCapPerDay: 10,
    hardQuestionsPerDay: 2,
    aiTextPerDay: 5,
    aiVideosPerMonth: 2,
    aiVideoNovelAllowed: false,
    groupsOwned: 1,
    groupMembers: 10,
    callType: "1:1",
    callMinutesCap: 15,
    screenShare: false,
    leaderboard: "own-only",
  },
  pro: {
    practiceQuestionsPerDay: -1,
    practiceSoftCapPerDay: 500,
    hardQuestionsPerDay: -1,
    aiTextPerDay: 100,
    aiVideosPerMonth: 20,
    aiVideoNovelAllowed: true,
    groupsOwned: -1,
    groupMembers: 250,
    callType: "group",
    callMinutesCap: -1,
    screenShare: true,
    leaderboard: "full",
  },
  admin: {
    practiceQuestionsPerDay: -1,
    practiceSoftCapPerDay: 10_000,
    hardQuestionsPerDay: -1,
    aiTextPerDay: -1,
    aiVideosPerMonth: -1,
    aiVideoNovelAllowed: true,
    groupsOwned: -1,
    groupMembers: 10_000,
    callType: "group",
    callMinutesCap: -1,
    screenShare: true,
    leaderboard: "full",
  },
};

export type QuotaKey =
  | "practice_questions"
  | "ai_text"
  | "ai_video"
  | "call_minutes";

/** Redis key helpers — fixed-window counters with TTL (spec §5.2). */
export function dailyQuotaKey(userId: string, day: string, key: QuotaKey) {
  return `quota:${userId}:${day}:${key}`;
}
export function monthlyQuotaKey(userId: string, month: string, key: QuotaKey) {
  return `quota:${userId}:${month}:${key}`;
}
export function dayBucket(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
export function monthBucket(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

// ── Phase 1: practice loop ──────────────────────────────────────────────

export type QuestionType = "mcq" | "short_answer" | "code";

export interface QuestionDTO {
  id: string;
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options?: string[];
  /** Present only after answering (prevents client-side cheating). */
  correctAnswer?: string;
  explanation?: string;
}

export interface AttemptResultDTO {
  attemptId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  correctAnswer: string;
  explanation: string;
  dailyScore: number;
  streak: StreakDTO;
}

export interface StreakDTO {
  current: number;
  longest: number;
  todayCount: number;
  /** Qualifying attempts per day before streak increments (spec §2.3 tunable). */
  qualifyingThreshold: number;
}

export interface LeaderboardEntryDTO {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

export const TOPICS = [
  "ml-basics",
  "statistics",
  "neural-networks",
  "deep-learning",
  "llms",
  "evaluation",
] as const;
export type Topic = (typeof TOPICS)[number];

/** Qualifying attempts within a UTC day to grow the streak (spec default: 1; raise to 3 later). */
export const STREAK_QUALIFYING_ATTEMPTS = 1;

/** Redis sorted-set key for the live daily board (spec §2.2). */
export function dailyBoardKey(day: string) {
  return `lb:daily:${day}`;
}

/**
 * Deterministic grading for Phase 1 (LLM rubric grading lands in Phase 2).
 * mcq: exact match. short_answer/code: normalized containment.
 */
export function gradeAnswer(
  type: QuestionType,
  correctAnswer: string,
  submitted: string,
): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (type === "mcq") return norm(submitted) === norm(correctAnswer);
  if (!norm(submitted)) return false;
  return (
    norm(correctAnswer).includes(norm(submitted)) ||
    norm(submitted).includes(norm(correctAnswer))
  );
}
