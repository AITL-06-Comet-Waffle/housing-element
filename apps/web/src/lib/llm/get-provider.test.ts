// @vitest-environment node
// getProvider() constructs the OpenAI client, which is server-side code. Run this
// file under Node (not the default jsdom), matching the Next.js server runtime —
// jsdom defines `window`, which trips the SDK's browser-safety guard.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProvider } from '@/lib/llm/get-provider';
import { MockLLMProvider } from '@/lib/llm/mock-provider';
import { OpenAIProvider } from '@/lib/llm/openai-provider';

describe('getProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the mock provider when LLM_PROVIDER is unset', () => {
    expect(getProvider()).toBeInstanceOf(MockLLMProvider);
  });

  it('returns the OpenAI provider when LLM_PROVIDER=openai and a key is set', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    expect(getProvider()).toBeInstanceOf(OpenAIProvider);
  });

  it('throws a clear error when OpenAI is selected without a key', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => getProvider()).toThrow(/OPENAI_API_KEY is required/);
  });
});
