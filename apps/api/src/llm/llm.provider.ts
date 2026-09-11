/**
 * LLM provider abstraction (spec §4: thin interface so we're not locked in).
 * - With GROQ_API_KEY + GROQ_MODEL set → GroqProvider.
 * - Without → StubProvider (deterministic, structurally-valid dev output).
 * Embeddings are intentionally NOT here: Groq has no embeddings API.
 * The `embedding` field on questions is reserved for a future Voyage/Atlas
 * vector path; Phase 2 dedupe uses offline token-set similarity instead.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'short_answer' | 'code';

export interface GeneratedQuestion {
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface GenerateInput {
  topic: string;
  difficulty: Difficulty;
  count: number;
  /** Prompts to avoid (recent bank samples) — reduces near-duplicates at the source. */
  avoidPrompts?: string[];
}

export interface AnswerResult {
  onTopic: boolean;
  /** Markdown answer (empty when off-topic). */
  answer: string;
}

export interface ExplainerScene {
  heading: string;
  bullets: string[];
  narration: string;
  /** Filled by the pipeline from narration pacing when absent. */
  durationSec?: number;
}

export interface ExplainerScript {
  title: string;
  scenes: ExplainerScene[];
}

export interface LlmProvider {
  readonly name: string;
  generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]>;
  /** Free-form Q&A with built-in topic verdict (single call on real providers). */
  answerQuestion(question: string): Promise<AnswerResult>;
  /** Short narrated slide script for explainer videos. */
  buildScript(question: string, answer: string): Promise<ExplainerScript>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';
