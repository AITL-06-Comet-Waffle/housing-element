import { describe, it, expect, vi } from 'vitest';
import type OpenAI from 'openai';
import { OpenAIProvider } from '@/lib/llm/openai-provider';
import { SYSTEM_PROMPT } from '@/lib/llm/system-prompt';

/** Build a fake OpenAI client whose chat.completions.create is the given spy. */
function fakeClient(create: ReturnType<typeof vi.fn>): OpenAI {
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

describe('OpenAIProvider', () => {
  it('prepends the system prompt, maps the conversation, and returns the reply text', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Wildfire risk near 90210 is generally elevated.' } }],
    });
    const provider = new OpenAIProvider(fakeClient(create), 'gpt-4o-mini');

    const reply = await provider.generate([
      { role: 'user', content: 'Tell me about 90210' },
      { role: 'assistant', content: 'Sure — anything specific?' },
      { role: 'user', content: 'wildfires' },
    ]);

    expect(reply).toBe('Wildfire risk near 90210 is generally elevated.');

    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0][0];
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(body.messages.slice(1)).toEqual([
      { role: 'user', content: 'Tell me about 90210' },
      { role: 'assistant', content: 'Sure — anything specific?' },
      { role: 'user', content: 'wildfires' },
    ]);
  });

  it('returns an empty string when the model returns no content', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] });
    const provider = new OpenAIProvider(fakeClient(create), 'gpt-4o-mini');

    expect(await provider.generate([{ role: 'user', content: 'hi' }])).toBe('');
  });

  it('lets API errors propagate to the caller', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'));
    const provider = new OpenAIProvider(fakeClient(create), 'gpt-4o-mini');

    await expect(provider.generate([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'rate limited',
    );
  });
});
