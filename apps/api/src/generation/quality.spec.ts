import { isDuplicate, jaccard, normalize, qualityCheck } from './quality.js';
import { GeneratedQuestion } from '../llm/llm.provider.js';

const goodMcq: GeneratedQuestion = {
  topic: 'llms',
  subtopic: 'pretraining',
  difficulty: 'easy',
  type: 'mcq',
  prompt: 'Most large language models are pretrained with which objective function?',
  options: ['Next-token prediction', 'Image rotation', 'Manual rule writing', 'Sorting words'],
  correct_answer: 'Next-token prediction',
  explanation: 'Causal language modeling predicts the next token and scales with data.',
};

describe('quality gates', () => {
  it('approves a well-formed question', () => {
    const v = qualityCheck(goodMcq);
    expect(v.ok).toBe(true);
    expect(v.score).toBe(1);
  });

  it('flags mcq whose answer is missing from options', () => {
    const v = qualityCheck({ ...goodMcq, correct_answer: 'Something else entirely' });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/not among options/);
  });

  it('flags thin prompts and duplicate options', () => {
    const v = qualityCheck({
      ...goodMcq,
      prompt: 'Too short?',
      options: ['A', 'A', 'B'],
      correct_answer: 'A',
      explanation: 'x',
    });
    expect(v.ok).toBe(false);
    expect(v.score).toBeLessThan(1);
  });

  it('normalizes punctuation/case for comparison', () => {
    expect(normalize('Hello,  WORLD!')).toBe('hello world');
  });

  it('jaccard detects near-duplicates, not distinct questions', () => {
    expect(jaccard('what is supervised learning', 'what is supervised learning?')).toBeGreaterThan(0.85);
    expect(jaccard('what is supervised learning', 'explain backpropagation in detail')).toBeLessThan(0.5);
  });

  it('isDuplicate catches exact and paraphrased prompts', () => {
    const bank = ['What is supervised learning in machine learning?'];
    expect(isDuplicate('What is supervised learning in machine learning?', bank)).toBe(true);
    expect(isDuplicate('What is supervised learning in machine learning please', bank)).toBe(true);
    expect(isDuplicate('How does a convolutional layer share weights spatially?', bank)).toBe(false);
  });
});
