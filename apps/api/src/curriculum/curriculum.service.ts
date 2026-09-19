import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model } from 'mongoose';
import { Attempt, AttemptDocument } from '../attempts/attempt.schema.js';
import { Question, QuestionDocument } from '../questions/question.schema.js';
import { envBool, envInt } from '../config.js';
import { Role } from '../common/entitlements.service.js';
import {
  TOPIC_GRAPH,
  type TopicId,
  type TopicNode,
  isTopicId,
  prerequisitesOf,
} from './curriculum.js';

export type TopicStatus = 'locked' | 'unlocked' | 'in_progress' | 'mastered';

export interface TopicGateState {
  topic: TopicId;
  status: TopicStatus;
  /** Current consecutive first-try, hint-free correct answers on this topic. */
  consecutiveCorrect: number;
  required: number;
  prerequisites: Array<{ topic: TopicId; mastered: boolean; consecutiveCorrect: number }>;
}

/**
 * Learning-path gating (Phase 8).
 *
 * Rule: a topic's questions are served only when every prerequisite topic is
 * "mastered" — `TOPIC_GATE_CONSECUTIVE_CORRECT` (default 3) consecutive
 * correct attempts on that topic, counting only first attempts of the day
 * (`is_retry` rows are reveal-assisted and do not count, and any recorded
 * `hint_used` row breaks the run). Admins bypass the gate so review tooling
 * keeps working; `TOPIC_GATE_ENABLED=false` disables it everywhere.
 *
 * All reads are tiny (≤ `required` docs per topic) and derived from the
 * `attempts` collection — no extra state to keep consistent.
 */
@Injectable()
export class CurriculumService {
  constructor(
    @InjectModel(Attempt.name) private readonly attempts: Model<AttemptDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
  ) {}

  gateEnabled(): boolean {
    return envBool('TOPIC_GATE_ENABLED', true);
  }

  requiredCorrect(): number {
    return envInt('TOPIC_GATE_CONSECUTIVE_CORRECT', 3);
  }

  /** Consecutive correct first-try attempts at the tail of a topic's history. */
  async consecutiveCorrect(userId: string, topic: TopicId): Promise<number> {
    const required = this.requiredCorrect();
    const rows = await this.attempts
      .find({
        user_id: userId,
        topic,
        is_retry: { $ne: true },
        hint_used: { $ne: true },
      })
      .sort({ _id: -1 })
      .limit(required)
      .select('is_correct')
      .lean()
      .exec();
    let streak = 0;
    for (const row of rows) {
      if (!row.is_correct) break;
      streak += 1;
    }
    return streak;
  }

  /** Gate state for every curriculum topic (one pass, parallel queries). */
  async topicStates(userId: string): Promise<Map<TopicId, TopicGateState>> {
    const required = this.requiredCorrect();
    const streaks = new Map<TopicId, number>();
    await Promise.all(
      TOPIC_GRAPH.map(async (node) => {
        streaks.set(node.id, await this.consecutiveCorrect(userId, node.id));
      }),
    );

    const states = new Map<TopicId, TopicGateState>();
    // Foundation → advanced order guarantees prerequisite states exist first:
    // TOPIC_GRAPH is topologically sorted by construction (see spec test).
    for (const node of TOPIC_GRAPH) {
      const streak = streaks.get(node.id) ?? 0;
      const mastered = streak >= required;
      const prerequisites = prerequisitesOf(node.id).map((p) => ({
        topic: p,
        mastered: (streaks.get(p) ?? 0) >= required,
        consecutiveCorrect: streaks.get(p) ?? 0,
      }));
      const unlocked = prerequisites.every((p) => p.mastered);
      const status: TopicStatus = mastered
        ? 'mastered'
        : !unlocked
          ? 'locked'
          : streak > 0
            ? 'in_progress'
            : 'unlocked';
      states.set(node.id, {
        topic: node.id,
        status,
        consecutiveCorrect: streak,
        required,
        prerequisites,
      });
    }
    return states;
  }

  isLocked(state: TopicGateState): boolean {
    return state.status === 'locked';
  }

  /** Topics whose prerequisites are not met (empty for admins / gate disabled). */
  async lockedTopics(userId: string, role: Role): Promise<TopicId[]> {
    if (role === 'admin' || !this.gateEnabled()) return [];
    const states = await this.topicStates(userId);
    return [...states.values()].filter((s) => this.isLocked(s)).map((s) => s.topic);
  }

  async isUnlocked(userId: string, role: Role, topic: TopicId): Promise<boolean> {
    if (role === 'admin' || !this.gateEnabled()) return true;
    const states = await this.topicStates(userId);
    return !this.isLocked(states.get(topic)!);
  }

  /**
   * Throws 403 when the learner has not met the topic's prerequisites.
   * Unknown topic ids pass through (the caller 404s from the empty bank).
   */
  async assertTopicAccess(userId: string, role: Role, topic: string): Promise<void> {
    if (!isTopicId(topic)) return;
    if (role === 'admin' || !this.gateEnabled()) return;
    const state = (await this.topicStates(userId)).get(topic)!;
    if (!this.isLocked(state)) return;
    throw new HttpException(
      {
        statusCode: 403,
        error: `Topic "${topic}" is locked — master its prerequisites first`,
        feature: 'topic_locked',
        topic,
        prerequisites: state.prerequisites,
        required: state.required,
      },
      HttpStatus.FORBIDDEN,
    );
  }

  /** Approved-question counts per topic × difficulty (for the skill tree UI). */
  private async questionCounts(): Promise<Record<string, Record<string, number>>> {
    const rows = await this.questions
      .aggregate([
        { $match: { quality_status: 'approved' } },
        { $group: { _id: { topic: '$topic', difficulty: '$difficulty' }, count: { $sum: 1 } } },
      ])
      .exec();
    const out: Record<string, Record<string, number>> = {};
    for (const row of rows as Array<{ _id: { topic: string; difficulty: string }; count: number }>) {
      out[row._id.topic] ??= {};
      out[row._id.topic][row._id.difficulty] = row.count;
    }
    return out;
  }

  /** Prerequisite DAG + the learner's per-topic lock/progress status. */
  async graphFor(userId: string) {
    const [counts, states] = await Promise.all([this.questionCounts(), this.topicStates(userId)]);
    return {
      nodes: TOPIC_GRAPH.map((node: TopicNode) => ({
        id: node.id,
        name: node.name,
        prerequisiteTopicIds: node.prerequisiteTopicIds,
        status: states.get(node.id)!.status,
        consecutiveCorrect: states.get(node.id)!.consecutiveCorrect,
        questionCounts: counts[node.id] ?? {},
      })),
      gate: {
        enabled: this.gateEnabled(),
        consecutiveCorrectRequired: this.requiredCorrect(),
      },
    };
  }
}
