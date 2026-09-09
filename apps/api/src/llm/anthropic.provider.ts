import Anthropic from '@anthropic-ai/sdk';
import { AnswerResult, ExplainerScript, GenerateInput, GeneratedQuestion, LlmProvider } from './llm.provider.js';

/**
 * Production provider: Claude generates questions as a JSON array.
 * Constructed only when ANTHROPIC_API_KEY + ANTHROPIC_MODEL are both set
 * (see LlmModule factory) — never with a half-configured client.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
    this.name = `anthropic:${model}`;
  }

  async generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {
    const avoid = (input.avoidPrompts ?? []).slice(0, 20);
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system:
        'You write concise, technically-accurate AI/ML practice questions. ' +
        'Reply with ONLY a JSON array, no prose or code fences. Each item: ' +
        '{topic, subtopic, difficulty ("easy"|"medium"|"hard"), type ("mcq"|"short_answer"|"code"), ' +
        'prompt, options (mcq only, 4 distinct choices), correct_answer (must equal one option for mcq), explanation (1-3 sentences)}.',
      messages: [
        {
          role: 'user',
          content:
            `Write ${input.count} ${input.difficulty} questions about "${input.topic}". ` +
            `Mix mcq and short_answer types. Vary subtopics; avoid trivial or duplicate questions.` +
            (avoid.length ? `\nDo NOT repeat or closely paraphrase these existing prompts:\n- ${avoid.join('\n- ')}` : ''),
        },
      ],
    });

    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(text) as GeneratedQuestion[];
    if (!Array.isArray(parsed)) throw new Error('LLM did not return a JSON array');
    return parsed.map((q) => ({ ...q, topic: input.topic, difficulty: input.difficulty }));
  }

  async answerQuestion(question: string): Promise<AnswerResult> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system:
        'You are a concise AI/ML tutor. Reply with ONLY a JSON object, no prose or code fences: ' +
        '{"onTopic": boolean, "answer": string}. onTopic is true only when the question is about ' +
        'AI, machine learning, deep learning, statistics for ML, or closely adjacent math/programming. ' +
        'When on-topic, answer is a helpful markdown explanation (under 300 words). When off-topic, ' +
        'answer is an empty string.',
      messages: [{ role: 'user', content: question }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(text) as AnswerResult;
    return { onTopic: parsed.onTopic === true, answer: parsed.onTopic ? (parsed.answer ?? '') : '' };
  }

  async buildScript(question: string, answer: string): Promise<ExplainerScript> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system:
        'You write 3-5 scene explainer-video scripts. Reply with ONLY a JSON object, no prose or code fences: ' +
        '{"title": string, "scenes": [{"heading": string (≤8 words), "bullets": string[1..3] (short phrases), ' +
        '"narration": string (1-3 spoken sentences)}]}. Narration must be speakable plain text, no markdown.',
      messages: [{ role: 'user', content: `Question: ${question}\nAnswer: ${answer.slice(0, 2000)}` }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(text) as ExplainerScript;
    return {
      title: String(parsed.title ?? question).slice(0, 80),
      scenes: (parsed.scenes ?? []).slice(0, 5).map((s) => ({
        heading: String(s.heading ?? '').slice(0, 60),
        bullets: (s.bullets ?? []).slice(0, 3).map((b) => String(b).slice(0, 90)),
        narration: String(s.narration ?? '').slice(0, 600),
      })),
    };
  }
}
