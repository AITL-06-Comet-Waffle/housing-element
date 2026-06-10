import type OpenAI from 'openai';
import type { LLMProvider, Message } from '@/lib/llm/types';
import { SYSTEM_PROMPT } from '@/lib/llm/system-prompt';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Real LLM provider backed by OpenAI Chat Completions.
 *
 * The OpenAI client is injected, so the provider is unit-testable with a fake (no
 * network, no key). It prepends the product system prompt, forwards the
 * conversation, and returns the assistant's text — implementing the same
 * {@link LLMProvider} seam as the mock, so the route and UI are unaffected.
 */
export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string = process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
  ) {}

  async generate(messages: Message[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) =>
          m.role === 'user'
            ? { role: 'user' as const, content: m.content }
            : { role: 'assistant' as const, content: m.content },
        ),
      ],
    });

    return completion.choices[0]?.message.content ?? '';
  }
}
