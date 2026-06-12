import { describe, it, expect, vi } from 'vitest';
import { searchFireIncidents } from './pinecone-retriever';
import type { PineconeNamespace } from './pinecone-retriever';

const makeHit = (fields: Record<string, unknown>) => ({ fields });

const sampleFields = {
  incident_name: 'WOOLSEY FIRE',
  county: 'Los Angeles',
  city: 'Malibu',
  incident_year: 2018,
  inspection_count: 1203,
  destroyed_count: 843,
  major_count: 87,
  minor_count: 41,
  no_damage_count: 232,
  chunk_text: 'The Woolsey Fire caused widespread destruction in Malibu.',
};

const makeNs = (hits: unknown[]): PineconeNamespace => ({
  searchRecords: vi.fn().mockResolvedValue({ result: { hits } }),
});

describe('searchFireIncidents', () => {
  it('returns mapped FireIncident array when hits are present', async () => {
    const ns = makeNs([makeHit(sampleFields)]);
    const results = await searchFireIncidents(ns, 'Malibu fire risk', 'Los Angeles');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject(sampleFields);
  });

  it('returns empty array when hits is empty', async () => {
    const ns = makeNs([]);
    const results = await searchFireIncidents(ns, 'test', 'Santa Cruz');
    expect(results).toEqual([]);
  });

  it('returns empty array when searchRecords throws', async () => {
    const ns: PineconeNamespace = { searchRecords: vi.fn().mockRejectedValue(new Error('api error')) };
    const results = await searchFireIncidents(ns, 'test', 'San Diego');
    expect(results).toEqual([]);
  });

  it('passes county as $eq filter inside query', async () => {
    const ns = makeNs([]);
    await searchFireIncidents(ns, 'test', 'Ventura');
    expect(ns.searchRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ filter: { county: { $eq: 'Ventura' } } }),
      }),
    );
  });

  it('passes user message as query text', async () => {
    const ns = makeNs([]);
    await searchFireIncidents(ns, 'fire risk near my address', 'Ventura');
    expect(ns.searchRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ inputs: { text: 'fire risk near my address' } }),
      }),
    );
  });
});
