import OpenAI from 'openai';
import type { LLMProvider } from '@/lib/llm/types';
import { mockLLMProvider } from '@/lib/llm/mock-provider';
import { OpenAIProvider } from '@/lib/llm/openai-provider';

/**
 * Select the chat provider from the environment.
 *
 * Defaults to the deterministic mock so tests and keyless dev run offline with no
 * billed calls. Set LLM_PROVIDER=openai (with OPENAI_API_KEY) to use the real
 * model. Everything stays behind the {@link LLMProvider} seam, so callers are
 * unchanged.
 */
export function getProvider(): LLMProvider {
  if (process.env.LLM_PROVIDER === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai.');
    }
    return new OpenAIProvider(new OpenAI({ apiKey }));
  }
  return mockLLMProvider;
}
