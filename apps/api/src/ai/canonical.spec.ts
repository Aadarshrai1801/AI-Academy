import { bestMatch, isOnTopicHeuristic, normalizeCanonical, similarity } from './canonical.js';

describe('canonical cache', () => {
  it('normalizes punctuation/case', () => {
    expect(normalizeCanonical('  What IS overfitting?? ')).toBe('what is overfitting');
  });

  it('exact-matches regardless of case/punctuation', () => {
    const cands = [{ normalized: 'what is overfitting' }];
    expect(bestMatch('What is overfitting?!', cands)?.score).toBe(1);
  });

  it('near-matches paraphrases above threshold, rejects distant ones', () => {
    const cands = [{ normalized: 'what is overfitting in machine learning models' }];
    // 7 shared / 8 union = 0.875: hits at 0.85, misses at the 0.92 default.
    expect(similarity('what is overfitting in machine learning models please', cands[0].normalized)).toBeCloseTo(0.875, 3);
    expect(bestMatch('what is overfitting in machine learning models please', cands, 0.85)?.score).toBeCloseTo(0.875, 3);
    expect(bestMatch('what is overfitting in machine learning models please', cands, 0.92)).toBeNull();
    expect(bestMatch('explain convolutional weight sharing in detail', cands, 0.85)).toBeNull();
  });

  it('topic gate allows AI/ML, rejects off-topic and tiny inputs', () => {
    expect(isOnTopicHeuristic('How does backpropagation update neural network weights?')).toBe(true);
    expect(isOnTopicHeuristic('What is the best recipe for pancakes?')).toBe(false);
    expect(isOnTopicHeuristic('hi')).toBe(false);
  });
});
