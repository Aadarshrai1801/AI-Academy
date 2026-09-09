import {
  Difficulty,
  AnswerResult,
  ExplainerScript,
  GenerateInput,
  GeneratedQuestion,
  LlmProvider,
} from './llm.provider.js';
import { isOnTopicHeuristic } from '../ai/canonical.js';
import { narrationDuration, splitAnswerToScenes } from '../video/script.js';

interface Template {
  subtopic: string;
  type: 'mcq' | 'short_answer';
  prompt: (n: number) => string;
  options?: (n: number) => string[];
  answer: (n: number) => string;
  explanation: string;
}

const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];

/**
 * Dev stub used when no ANTHROPIC_API_KEY is configured.
 * Deterministic template + counter rotation → unique, structurally-valid
 * questions that exercise the full pipeline (quality check → dedupe → insert).
 * NEVER used in production (factory swaps in AnthropicProvider when a key exists).
 */
export class StubProvider implements LlmProvider {
  readonly name = 'stub-dev-v1';
  private counter = 0;

  private readonly pools: Record<string, Template[]> = {
    'ml-basics': [
      {
        subtopic: 'concepts', type: 'mcq',
        prompt: (n) => `A team trains a classifier on ${1000 + n * 500} labeled images. This is an example of…`,
        options: () => ['Supervised learning', 'Unsupervised learning', 'Reinforcement learning', 'Self-play'],
        answer: () => 'Supervised learning',
        explanation: 'Labeled input-output pairs define supervised learning.',
      },
      {
        subtopic: 'workflow', type: 'mcq',
        prompt: (n) => `Your model scores ${90 + (n % 9)}% on training data but ${60 + (n % 15)}% on held-out data. What should you try first?`,
        options: () => ['Add regularization / more data', 'Train longer on the same data', 'Delete the test set', 'Increase model size 10x'],
        answer: () => 'Add regularization / more data',
        explanation: 'A large train-test gap signals overfitting; regularize or add data.',
      },
      {
        subtopic: 'metrics', type: 'short_answer',
        prompt: (n) => `Name the validation technique that splits data into ${3 + (n % 7)} rotating folds (two words).`,
        answer: () => 'cross validation',
        explanation: 'Cross-validation averages performance over rotating folds for a robust estimate.',
      },
    ],
    statistics: [
      {
        subtopic: 'probability', type: 'mcq',
        prompt: (n) => `A fair coin is flipped ${2 + (n % 6)} times. What is P(all heads)?`,
        options: (n) => {
          const k = 2 + (n % 6);
          const p = `1/${2 ** k}`;
          return [p, `1/${k + 1}`, '1/2', `${k}/8`];
        },
        answer: (n) => `1/${2 ** (2 + (n % 6))}`,
        explanation: 'Independent flips multiply: (1/2)^k for k flips.',
      },
      {
        subtopic: 'descriptive', type: 'mcq',
        prompt: (n) => `Dataset: [${3 + (n % 5)}, ${4 + (n % 5)}, ${100 + n}]. Which summary is least distorted?`,
        options: () => ['Median', 'Mean', 'Sum', 'Range'],
        answer: () => 'Median',
        explanation: 'The median resists the single large outlier; the mean does not.',
      },
      {
        subtopic: 'inference', type: 'short_answer',
        prompt: () => 'Name the rule giving the share of normal data within ±2 standard deviations (two digits + %):',
        answer: () => '95%',
        explanation: 'The 68-95-99.7 rule puts ~95% within two sigma.',
      },
    ],
    'neural-networks': [
      {
        subtopic: 'activations', type: 'mcq',
        prompt: (n) => `The ReLU activation is applied to the input value ${n % 5}. What is the output?`,
        options: (n) => {
          const v = n % 5; // 0..4 — non-negative so options stay distinct after normalization
          return v === 0 ? ['0', '1', '2', '3'] : [`${v}`, '0', `${v + 1}`, `${v + 2}`];
        },
        answer: (n) => `${n % 5}`,
        explanation: 'ReLU(x) = max(0, x): non-negative inputs pass through unchanged.',
      },
      {
        subtopic: 'training', type: 'mcq',
        prompt: () => 'Backpropagation is best described as…',
        options: () => ['Chain-rule gradient computation', 'Direct weight solving', 'Architecture search', 'Data augmentation'],
        answer: () => 'Chain-rule gradient computation',
        explanation: 'Backprop applies the chain rule layer by layer to get gradients.',
      },
      {
        subtopic: 'loss', type: 'short_answer',
        prompt: () => 'Name the loss paired with softmax for multi-class classification (two words):',
        answer: () => 'cross entropy',
        explanation: 'Categorical cross-entropy penalizes confident wrong predictions.',
      },
    ],
    'deep-learning': [
      {
        subtopic: 'attention', type: 'mcq',
        prompt: (n) => `Self-attention over a sequence of length ${8 + (n % 24)} costs…`,
        // Worded so choices stay distinct after normalization (O(n) vs O(n²) would collide).
        options: () => ['Quadratic O(n^2)', 'Linear O(n)', 'Logarithmic O(log n)', 'Constant O(1)'],
        answer: () => 'Quadratic O(n^2)',
        explanation: 'Every token attends to every other: the n×n matrix dominates.',
      },
      {
        subtopic: 'rnn', type: 'mcq',
        prompt: () => 'LSTMs beat vanilla RNNs on long sequences mainly because of…',
        options: () => ['Gating over a cell state', 'Fewer parameters', 'No backprop', 'Larger batches'],
        answer: () => 'Gating over a cell state',
        explanation: 'Input/forget/output gates preserve gradients across long spans.',
      },
      {
        subtopic: 'regularization', type: 'short_answer',
        prompt: (n) => `Dropout with rate 0.${1 + (n % 5)} zeroes what share of activations in training?`,
        answer: (n) => `${10 + (n % 5) * 10}%`,
        explanation: 'Dropout randomly zeroes a fraction p of activations each step.',
      },
    ],
    llms: [
      {
        subtopic: 'pretraining', type: 'mcq',
        prompt: () => 'The dominant LLM pretraining objective is…',
        options: () => ['Next-token prediction', 'Image rotation', 'Manual rules', 'Alphabetical sorting'],
        answer: () => 'Next-token prediction',
        explanation: 'Causal language modeling scales with data and compute.',
      },
      {
        subtopic: 'decoding', type: 'mcq',
        prompt: (n) => `Raising temperature from 0.${n % 3} to 1.${n % 5} makes outputs…`,
        options: () => ['More random/diverse', 'Fully deterministic', 'Shorter always', 'Lower perplexity always'],
        answer: () => 'More random/diverse',
        explanation: 'Higher temperature flattens the sampling distribution.',
      },
      {
        subtopic: 'rag', type: 'short_answer',
        prompt: () => 'What three-letter technique grounds answers in retrieved documents?',
        answer: () => 'rag',
        explanation: 'Retrieval-Augmented Generation conditions answers on fetched passages.',
      },
    ],
    evaluation: [
      {
        subtopic: 'classification-metrics', type: 'mcq',
        prompt: (n) => `A fraud detector is ${97 + (n % 2)}% accurate but catches no fraud. The problem is…`,
        options: () => ['Class imbalance', 'Too much data', 'Low latency', 'Clean labels'],
        answer: () => 'Class imbalance',
        explanation: 'Majority-class prediction inflates accuracy; use precision/recall.',
      },
      {
        subtopic: 'splits', type: 'mcq',
        prompt: () => 'A model tuned repeatedly on one validation set risks…',
        options: () => ['Optimism bias', 'Faster training', 'Better calibration', 'Less variance'],
        answer: () => 'Optimism bias',
        explanation: 'The validation set becomes implicit training data; keep a held-out test set.',
      },
      {
        subtopic: 'ab-testing', type: 'short_answer',
        prompt: () => 'In an A/B test, what is the unchanged baseline group called?',
        answer: () => 'control',
        explanation: 'Control vs treatment isolates the causal effect.',
      },
    ],
  };

  async generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {    const pool = this.pools[input.topic] ?? this.pools['ml-basics'];
    const out: GeneratedQuestion[] = [];
    for (let i = 0; i < input.count; i++) {
      const t = pick(pool, this.counter);
      const n = this.counter++;
      out.push({
        topic: input.topic,
        subtopic: t.subtopic,
        difficulty: input.difficulty as Difficulty,
        type: t.type,
        prompt: t.prompt(n),
        options: t.options?.(n),
        correct_answer: t.answer(n),
        explanation: t.explanation,
      });
    }
    return out;
  }

  async answerQuestion(question: string): Promise<AnswerResult> {
    if (!isOnTopicHeuristic(question)) return { onTopic: false, answer: '' };
    return {
      onTopic: true,
      answer:
        `**Dev-stub answer** (set \`GROQ_API_KEY\` for a real explanation).\n\n` +
        `Your question looks on-topic for AI/ML tutoring. A full answer would cover the key concepts, ` +
        `a worked example, and common pitfalls — plus curated YouTube recommendations below.\n\n` +
        `> ${question.trim().slice(0, 280)}`,
    };
  }

  async buildScript(question: string, answer: string): Promise<ExplainerScript> {
    const s = splitAnswerToScenes(question, answer);
    return {
      title: s.title,
      scenes: s.scenes.map((sc) => ({
        heading: sc.heading,
        bullets: sc.bullets,
        narration: sc.narration,
        durationSec: narrationDuration(sc.narration),
      })),
    };
  }
}
