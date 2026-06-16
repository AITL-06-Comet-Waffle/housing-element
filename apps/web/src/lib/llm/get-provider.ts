import OpenAI from 'openai';
import type { LLMProvider } from '@/lib/llm/types';
import { mockLLMProvider } from '@/lib/llm/mock-provider';
import { OpenAIProvider } from '@/lib/llm/openai-provider';
import { buildRagProvider } from '@/lib/rag/build-rag-provider';

/**
 * Select the chat provider from the environment.
 *
 * Defaults to the deterministic mock so tests and keyless dev run offline with no
 * billed calls. Set LLM_PROVIDER=openai (with OPENAI_API_KEY) to use the real
 * model. Set RAG_ENABLED=true to wrap the provider with Pinecone fire-risk retrieval.
 * Everything stays behind the {@link LLMProvider} seam, so callers are unchanged.
 */
export function getProvider(): LLMProvider {
  let base: LLMProvider;
  if (process.env.LLM_PROVIDER === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai.');
    }
    base = new OpenAIProvider(new OpenAI({ apiKey }));
  } else {
    base = mockLLMProvider;
  }
  return buildRagProvider(base) ?? base;
}

/**
 * Select the LLM used for risk narration, or `null` to fall back to the
 * deterministic template. Returns the OpenAI provider only when LLM_PROVIDER=openai
 * and a key is set — never RAG-wrapped (narration takes facts, not a query), and
 * never throws (a misconfig degrades to the template rather than failing the route).
 */
export function getNarrator(): LLMProvider | null {
  if (process.env.LLM_PROVIDER !== 'openai') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[getNarrator] LLM_PROVIDER=openai but OPENAI_API_KEY is unset; using template.');
    return null;
  }
  return new OpenAIProvider(new OpenAI({ apiKey }));
}
