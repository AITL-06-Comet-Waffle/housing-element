import type { LLMProvider, Message } from '@/lib/llm/types';

/**
 * Deterministic stand-in for a real LLM.
 *
 * Echoes the most recent user message so the chat plumbing can be exercised
 * end-to-end without a model, API key, or network. The same input always yields
 * the same output, which keeps tests deterministic. Swapping in the real provider
 * later is a one-file change behind {@link LLMProvider}.
 */
export class MockLLMProvider implements LLMProvider {
  async generate(messages: Message[]): Promise<string> {
    const lastUser = messages.findLast((m) => m.role === 'user');
    return lastUser
      ? `You said: "${lastUser.content}"`
      : "Ask me about a home or area and I'll help you explore it.";
  }
}

/** Shared instance used by the chat route in step 1. */
export const mockLLMProvider = new MockLLMProvider();
