import { describe, it, expect, vi } from 'vitest';
import { RagProvider } from './rag-provider';
import type { LLMProvider, Message } from '@/lib/llm/types';
import type { GeoResult } from './geocode';
import type { FireIncident, PineconeNamespace } from './pinecone-retriever';

const messages: Message[] = [
  { role: 'user', content: 'Is 1234 Pacific Coast Hwy, Malibu CA at risk of fires?' },
];

const geo: GeoResult = { lat: 34.02, lon: -118.49, county: 'Los Angeles', city: 'Malibu' };

const incident: FireIncident = {
  incident_name: 'WOOLSEY FIRE',
  county: 'Los Angeles',
  city: 'Malibu',
  incident_year: 2018,
  inspection_count: 1203,
  destroyed_count: 843,
  major_count: 87,
  minor_count: 41,
  no_damage_count: 232,
  chunk_text: 'Widespread destruction in Malibu.',
};

const makeInner = (): LLMProvider => ({ generate: vi.fn().mockResolvedValue('reply') });

const makeNs = (incidents: FireIncident[]): PineconeNamespace => ({
  searchRecords: vi.fn().mockResolvedValue({ result: { hits: incidents.map((f) => ({ fields: f })) } }),
});

describe('RagProvider', () => {
  it('delegates to inner with original messages when geocode returns null', async () => {
    const inner = makeInner();
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(null), makeNs([incident]), 'agent');
    await provider.generate(messages);
    expect(inner.generate).toHaveBeenCalledWith(messages);
  });

  it('delegates to inner with original messages when no incidents are found', async () => {
    const inner = makeInner();
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(geo), makeNs([]), 'agent');
    await provider.generate(messages);
    expect(inner.generate).toHaveBeenCalledWith(messages);
  });

  it('inserts context message before the final user message when incidents are found', async () => {
    const inner = makeInner();
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(geo), makeNs([incident]), 'agent');
    await provider.generate(messages);

    const calledWith = (inner.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message[];
    expect(calledWith).toHaveLength(2);
    expect(calledWith[0].role).toBe('user');
    expect(calledWith[0].content).toContain('WOOLSEY FIRE');
    expect(calledWith[1]).toEqual(messages[0]);
  });

  it('falls through gracefully when geocode throws', async () => {
    const inner = makeInner();
    const provider = new RagProvider(
      inner,
      vi.fn().mockRejectedValue(new Error('geocode error')),
      makeNs([incident]),
      'agent',
    );
    await provider.generate(messages);
    expect(inner.generate).toHaveBeenCalledWith(messages);
  });

  it('falls through gracefully when Pinecone throws', async () => {
    const inner = makeInner();
    const ns: PineconeNamespace = { searchRecords: vi.fn().mockRejectedValue(new Error('pinecone error')) };
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(geo), ns, 'agent');
    await provider.generate(messages);
    expect(inner.generate).toHaveBeenCalledWith(messages);
  });

  it('calls inner provider exactly once', async () => {
    const inner = makeInner();
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(geo), makeNs([incident]), 'agent');
    await provider.generate(messages);
    expect(inner.generate).toHaveBeenCalledTimes(1);
  });

  it('returns the inner provider reply', async () => {
    const inner = makeInner();
    const provider = new RagProvider(inner, vi.fn().mockResolvedValue(geo), makeNs([incident]), 'agent');
    const reply = await provider.generate(messages);
    expect(reply).toBe('reply');
  });
});
