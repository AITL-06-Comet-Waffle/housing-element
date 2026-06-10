import { describe, it, expect } from 'vitest';
import { MockLLMProvider } from '@/lib/llm/mock-provider';

describe('MockLLMProvider', () => {
  it('echoes the most recent user message', async () => {
    const reply = await new MockLLMProvider().generate([
      { role: 'user', content: 'Tell me about 90210' },
    ]);
    expect(reply).toBe('You said: "Tell me about 90210"');
  });

  it('uses the latest user message when prior assistant history exists', async () => {
    const reply = await new MockLLMProvider().generate([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'You said: "hello"' },
      { role: 'user', content: 'what about wildfires?' },
    ]);
    expect(reply).toBe('You said: "what about wildfires?"');
  });

  it('returns a deterministic prompt when there is no user message', async () => {
    const reply = await new MockLLMProvider().generate([]);
    expect(reply).toBe("Ask me about a home or area and I'll help you explore it.");
  });
});
