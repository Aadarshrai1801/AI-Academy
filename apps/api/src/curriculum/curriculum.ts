/**
 * Learning-path curriculum: the prerequisite DAG that gates question serving.
 *
 * Mirrors `TOPIC_GRAPH` in `packages/shared` (the API keeps a local copy by
 * design — no cross-workspace runtime imports; contract tests in
 * `packages/shared/test` guard the shared copy, `curriculum.spec.ts` this one).
 */

export const TOPIC_IDS = [
  'ml-basics',
  'statistics',
  'neural-networks',
  'deep-learning',
  'llms',
  'evaluation',
] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export interface TopicNode {
  id: TopicId;
  name: string;
  prerequisiteTopicIds: TopicId[];
}

export const TOPIC_GRAPH: readonly TopicNode[] = [
  { id: 'ml-basics', name: 'Machine Learning Basics', prerequisiteTopicIds: [] },
  { id: 'statistics', name: 'Probability & Statistics', prerequisiteTopicIds: [] },
  {
    id: 'neural-networks',
    name: 'Neural Networks',
    prerequisiteTopicIds: ['ml-basics', 'statistics'],
  },
  {
    id: 'evaluation',
    name: 'Model Evaluation',
    prerequisiteTopicIds: ['ml-basics', 'statistics'],
  },
  { id: 'deep-learning', name: 'Deep Learning', prerequisiteTopicIds: ['neural-networks'] },
  { id: 'llms', name: 'Large Language Models', prerequisiteTopicIds: ['deep-learning'] },
];

const BY_ID = new Map<string, TopicNode>(TOPIC_GRAPH.map((n) => [n.id, n]));

export function isTopicId(value: unknown): value is TopicId {
  return typeof value === 'string' && BY_ID.has(value);
}

export function topicNode(topic: TopicId): TopicNode {
  // Non-null by construction: TOPIC_IDS and TOPIC_GRAPH are kept in sync.
  return BY_ID.get(topic)!;
}

export function prerequisitesOf(topic: TopicId): TopicId[] {
  return topicNode(topic).prerequisiteTopicIds;
}
