import { Global, Module } from '@nestjs/common';
import { LLM_PROVIDER, LlmProvider } from './llm.provider.js';
import { GroqProvider } from './groq.provider.js';
import { StubProvider } from './stub.provider.js';

/**
 * Provider selection (Groq LLM backend with deterministic dev stub fallback).
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
        if (!warned) {
          warned = true;
          // eslint-disable-next-line no-console
          console.warn(
            '[llm] GROQ_API_KEY/GROQ_MODEL not fully set — using stub-dev-v1. ' +
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
