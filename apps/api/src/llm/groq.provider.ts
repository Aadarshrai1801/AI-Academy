import { AnswerResult, ExplainerScript, GenerateInput, GeneratedQuestion, LlmProvider } from './llm.provider.js';

/**
 * Groq provider (OpenAI-compatible): https://api.groq.com/openai/v1/chat/completions
 * Free tier, no SDK needed — plain fetch. Same LlmProvider interface as Anthropic.
 * Constructed only when GROQ_API_KEY + GROQ_MODEL are both set (see LlmModule).
 */
export class GroqProvider implements LlmProvider {
  readonly name: string;
  private readonly models: string[];
  private cursor = 0;

  constructor(
    private readonly apiKey: string,
    model: string,
    fallbackModels: string[] = [],
  ) {
    this.models = [model, ...fallbackModels.filter((m) => m && m !== model)];
    this.name = `groq:${this.models[0]}+${this.models.length - 1}fb`;
  }

  /** Round-robin across models — Groq free limits are per-model, so 3 models ≈ 3x throughput. */
  private pickModel(): string {
    const m = this.models[this.cursor % this.models.length];
    this.cursor++;
    return m;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async chat(system: string, user: string, maxTokens: number, temperature = 0.5): Promise<string> {
    let lastErr: unknown = null;
    // Attempts spread across rotated models: 4 rounds × models.
    const totalTries = 4 * this.models.length;
    for (let attempt = 0; attempt < totalTries; attempt++) {
      const model = this.pickModel();
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? '';
        if (text.trim()) return text;
        lastErr = new Error('Groq returned empty content');
      } else {
        const body = await res.text().catch(() => '');
        lastErr = new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
        // Retry only transient: 429 + 5xx. 4xx (bad key/model) fails fast.
        if (res.status !== 429 && res.status < 500) throw lastErr;
        const retryAfter = Number(res.headers.get('retry-after'));
        await this.sleep(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2000 * 2 ** attempt,
        );
        continue;
      }
      await this.sleep(1500 * 2 ** attempt);
    }
    throw lastErr instanceof Error ? lastErr : new Error('Groq request failed after retries');
  }

  private cleanJson(text: string): string {
    return text
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
  }

  /** gpt-oss models sometimes wrap the array in an object or add prose — extract robustly. */
  private parseJsonArray<T>(text: string): T[] {
    const clean = this.cleanJson(text);
    try {
      const direct = JSON.parse(clean) as unknown;
      if (Array.isArray(direct)) return direct as T[];
      if (direct && typeof direct === 'object') {
        const obj = direct as Record<string, unknown>;
        for (const v of Object.values(obj)) {
          if (Array.isArray(v)) return v as T[];
        }
      }
    } catch { /* fall through to bracket extraction */ }
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const slice = JSON.parse(clean.slice(start, end + 1)) as unknown;
      if (Array.isArray(slice)) return slice as T[];
    }
    throw new Error('LLM did not return a JSON array');
  }

  async generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {
    const avoid = (input.avoidPrompts ?? []).slice(0, 8);
    const text = await this.chat(
      'You write concise, technically-accurate AI/ML practice questions. ' +
        'Reply with ONLY a JSON object {"questions": [...]}, no prose or code fences. Each item: ' +
        '{topic, subtopic, difficulty ("easy"|"medium"|"hard"), type ("mcq"|"short_answer"), ' +
        'prompt, options (mcq only, 4 distinct choices), correct_answer (must equal one option for mcq), explanation (1-3 sentences)}. ' +
        'Use short_answer for at least a third of items.',
      `Write ${input.count} ${input.difficulty} questions about "${input.topic}". ` +
        `Vary subtopics; avoid trivial or duplicate questions.` +
        (avoid.length ? `\nDo NOT repeat or closely paraphrase these existing prompts:\n- ${avoid.join('\n- ')}` : ''),
      4000,
    );
    const parsed = this.parseJsonArray<GeneratedQuestion>(text);
    return parsed.map((q) => ({ ...q, topic: input.topic, difficulty: input.difficulty }));
  }

  async answerQuestion(question: string): Promise<AnswerResult> {
    const text = await this.chat(
      'You are a concise AI/ML tutor. Reply with ONLY a JSON object, no prose or code fences: ' +
        '{"onTopic": boolean, "answer": string}. onTopic is true only when the question is about ' +
        'AI, machine learning, deep learning, statistics for ML, or closely adjacent math/programming. ' +
        'When on-topic, answer is a helpful markdown explanation (under 300 words). When off-topic, ' +
        'answer is an empty string.',
      question,
      1500,
    );
    const parsed = JSON.parse(this.cleanJson(text)) as AnswerResult;
    return { onTopic: parsed.onTopic === true, answer: parsed.onTopic ? (parsed.answer ?? '') : '' };
  }

  async buildScript(question: string, answer: string): Promise<ExplainerScript> {
    const text = await this.chat(
      'You write 3-5 scene explainer-video scripts. Reply with ONLY a JSON object, no prose or code fences: ' +
        '{"title": string, "scenes": [{"heading": string (≤8 words), "bullets": string[1..3] (short phrases), ' +
        '"narration": string (1-3 spoken sentences)}]}. Narration must be speakable plain text, no markdown.',
      `Question: ${question}\nAnswer: ${answer.slice(0, 2000)}`,
      2000,
    );
    const parsed = JSON.parse(this.cleanJson(text)) as ExplainerScript;
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
