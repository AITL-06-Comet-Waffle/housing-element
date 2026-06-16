// @vitest-environment node
// getProvider() constructs the OpenAI client, which is server-side code. Run this
// file under Node (not the default jsdom), matching the Next.js server runtime —
// jsdom defines `window`, which trips the SDK's browser-safety guard.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProvider, getNarrator } from '@/lib/llm/get-provider';
import { MockLLMProvider } from '@/lib/llm/mock-provider';
import { OpenAIProvider } from '@/lib/llm/openai-provider';
import { RagProvider } from '@/lib/rag/rag-provider';

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

  describe('RAG_ENABLED=true', () => {
    it('returns a RagProvider when all required env vars are set', () => {
      vi.stubEnv('RAG_ENABLED', 'true');
      vi.stubEnv('PINECONE_API_KEY', 'pcsk-test-key');
      vi.stubEnv('NOMINATIM_USER_AGENT', 'housing-element/test');
      expect(getProvider()).toBeInstanceOf(RagProvider);
    });

    it('throws when PINECONE_API_KEY is missing', () => {
      vi.stubEnv('RAG_ENABLED', 'true');
      vi.stubEnv('PINECONE_API_KEY', '');
      vi.stubEnv('NOMINATIM_USER_AGENT', 'housing-element/test');
      expect(() => getProvider()).toThrow(/PINECONE_API_KEY is required/);
    });

    it('throws when NOMINATIM_USER_AGENT is missing', () => {
      vi.stubEnv('RAG_ENABLED', 'true');
      vi.stubEnv('PINECONE_API_KEY', 'pcsk-test-key');
      vi.stubEnv('NOMINATIM_USER_AGENT', '');
      expect(() => getProvider()).toThrow(/NOMINATIM_USER_AGENT is required/);
    });
  });
});

describe('getNarrator', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when LLM_PROVIDER is not openai (template fallback)', () => {
    expect(getNarrator()).toBeNull();
  });

  it('returns an OpenAIProvider when openai is configured', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    expect(getNarrator()).toBeInstanceOf(OpenAIProvider);
  });

  it('returns null (does not throw) when openai is selected without a key', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(getNarrator()).toBeNull();
  });
});
