import { Global, Module } from '@nestjs/common';
import { LLM_PROVIDER, LlmProvider } from './llm.provider.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { GroqProvider } from './groq.provider.js';
import { StubProvider } from './stub.provider.js';

/**
 * Provider selection (spec §4: swappable LLM backends).
 * Priority: Groq (free) → Anthropic → deterministic dev stub.
 * Each needs BOTH key + model; anything less → stub with a loud
 * one-time warning (never silently burn money or fail).
 */
let warned = false;

@Global()
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      useFactory: (): LlmProvider => {
        const groqKey = process.env.GROQ_API_KEY;
        const groqModel = process.env.GROQ_MODEL;
        if (groqKey && groqModel) {
          const fallbacks = (process.env.GROQ_MODELS ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== groqModel);
          return new GroqProvider(groqKey, groqModel, fallbacks);
        }
        const key = process.env.ANTHROPIC_API_KEY;
        const model = process.env.ANTHROPIC_MODEL;
        if (key && model) return new AnthropicProvider(key, model);
        if (!warned) {
          warned = true;
          // eslint-disable-next-line no-console
          console.warn(
            '[llm] GROQ_API_KEY/GROQ_MODEL nor ANTHROPIC_API_KEY/ANTHROPIC_MODEL fully set — using stub-dev-v1. ' +
              'Set GROQ_API_KEY + GROQ_MODEL to enable real generation.',
          );
        }
        return new StubProvider();
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
