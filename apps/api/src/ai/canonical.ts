/**
 * Canonical-question matching + on-topic heuristic (spec §2.6).
 * Offline token-set similarity stands in for embedding cosine until an
 * embeddings provider is configured; the 0.92 default mirrors the spec's
 * cosine threshold. Pure functions — unit-tested.
 */

export const normalizeCanonical = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenSet = (s: string) => new Set(normalizeCanonical(s).split(' ').filter(Boolean));

export function similarity(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Best candidate above threshold, or null (cache miss → generate). */
export function bestMatch<T extends { normalized: string }>(
  question: string,
  candidates: T[],
  threshold = 0.92,
): { item: T; score: number } | null {
  const norm = normalizeCanonical(question);
  let best: { item: T; score: number } | null = null;
  for (const c of candidates) {
    if (c.normalized === norm) return { item: c, score: 1 };
    const score = similarity(norm, c.normalized);
    if (score >= threshold && (!best || score > best.score)) best = { item: c, score };
  }
  return best;
}

/**
 * Dev topic gate: is this plausibly an AI/ML question?
 * Crude by design — the Anthropic path uses an LLM verdict instead.
 * Used ONLY by the stub provider and as a pre-filter; errs toward allow.
 */
const TOPIC_TERMS = [
  'ai', 'ml', 'machine learning', 'artificial intelligence', 'neural', 'deep learning',
  'llm', 'gpt', 'transformer', 'gradient', 'backprop', 'training', 'trained', 'model',
  'dataset', 'data', 'overfit', 'underfit', 'regression', 'classif', 'cluster',
  'nlp', 'vision', 'cnn', 'rnn', 'lstm', 'diffusion', 'embedding', 'token',
  'attention', 'pytorch', 'tensorflow', 'keras', 'sklearn', 'scikit', 'pandas',
  'numpy', 'statistic', 'probability', 'bayes', 'loss', 'optim', 'accuracy',
  'precision', 'recall', 'epoch', 'batch', 'layer', 'weight', 'bias', 'prompt',
  'fine-tune', 'finetune', 'rag', 'agent', 'reinforcement', 'supervised',
  'unsupervised', 'generative', 'gan', 'autoencoder', 'forecast', 'predict',
  'python', 'algorithm', 'vector', 'matrix', 'calculus', 'linear algebra',
];

export function isOnTopicHeuristic(question: string): boolean {
  const norm = ` ${normalizeCanonical(question)} `;
  if (norm.trim().split(' ').length < 3) return false;
  return TOPIC_TERMS.some((t) => norm.includes(` ${t} `) || norm.includes(` ${t}s `));
}
