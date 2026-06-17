import { describe, it, expect, vi } from 'vitest';
import { fireColor, floodColor, quakeColor, getHazardColor, formatColorContext } from './hazard-color';
import type { PineconeNamespace } from './pinecone-retriever';

const nsWith = (hits: Record<string, unknown>[]): PineconeNamespace =>
  ({
    searchRecords: vi.fn().mockResolvedValue({ result: { hits: hits.map((f) => ({ fields: f })) } }),
  }) as unknown as PineconeNamespace;

const emptyNs = (): PineconeNamespace =>
  ({ searchRecords: vi.fn().mockResolvedValue({ result: { hits: [] } }) }) as unknown as PineconeNamespace;

const MALIBU = { lat: 34.03, lon: -118.68 };

describe('fireColor', () => {
  it('returns the worst nearby distinct incidents (county-filtered, deduped, far ones dropped)', async () => {
    const ns = nsWith([
      { incident_name: 'Woolsey', county: 'Los Angeles', incident_year: '2018', destroyed_count: '650', latitude: '34.04', longitude: '-118.70' }, // ~2 km
      { incident_name: 'Palisades', county: 'Los Angeles', incident_year: '2025', destroyed_count: '1260', latitude: '34.03', longitude: '-118.70' }, // ~2 km
      { incident_name: 'Palisades', county: 'Los Angeles', incident_year: '2025', destroyed_count: '5463', latitude: '34.05', longitude: '-118.53' }, // same incident, ~14 km
      { incident_name: 'Eaton', county: 'Los Angeles', incident_year: '2025', destroyed_count: '9100', latitude: '34.19', longitude: '-118.13' }, // ~54 km away
    ]);
    const items = await fireColor(ns, 'Los Angeles', MALIBU, 'Malibu, CA');
    const sources = items.map((i) => i.source);
    expect(sources).toEqual([
      'CAL FIRE DINS — Palisades (Los Angeles, 2025)', // most destroyed among the nearby set
      'CAL FIRE DINS — Woolsey (Los Angeles, 2018)',
    ]);
    expect(sources).not.toContain('CAL FIRE DINS — Eaton (Los Angeles, 2025)'); // beyond 50 km
    expect(items[0].summary).toContain('6,723 structures destroyed'); // 1,260 + 5,463 aggregated
  });

  it('filters by county via the Pinecone filter', async () => {
    const ns = emptyNs();
    await fireColor(ns, 'Butte', { lat: 39.75, lon: -121.6 }, 'Paradise, CA');
    expect(ns.searchRecords).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ filter: { county: { $eq: 'Butte' } } }) }),
    );
  });
});

describe('floodColor', () => {
  it('formats the nearest NOAA flood with property damage', async () => {
    const ns = nsWith([
      { event_type: 'Flood', county_zone_name: 'LOS ANGELES', year: '2010', damage_property_usd: '1500000', begin_location: 'MALIBU', begin_latitude: '34.03', begin_longitude: '-118.69' },
      { event_type: 'Flash Flood', county_zone_name: 'LOS ANGELES', year: '2005', damage_property_usd: '0', begin_location: 'LANCASTER', begin_latitude: '34.70', begin_longitude: '-118.10' },
    ]);
    const items = await floodColor(ns, 'LOS ANGELES', MALIBU, 'Malibu, CA');
    expect(items[0].summary).toContain('2010');
    expect(items[0].summary).toMatch(/\$1,500,000/);
    expect(items[0].source).toContain('NOAA Storm Events — LOS ANGELES');
  });
});

describe('quakeColor', () => {
  it('keeps only nearby quakes, nearest first', async () => {
    const ns = nsWith([
      { place: 'Far north', magnitude: '7.0', event_year: '1900', latitude: '40.0', longitude: '-124.0' },
      { place: 'Near LA', magnitude: '5.5', event_year: '1994', latitude: '34.05', longitude: '-118.65' },
    ]);
    const items = await quakeColor(ns, MALIBU, 'Malibu, CA');
    expect(items).toHaveLength(1);
    expect(items[0].summary).toContain('Near LA');
    expect(items[0].summary).toMatch(/~\d+ km away/);
  });
});

describe('getHazardColor', () => {
  it('combines hazards into items + an LLM context block', async () => {
    const deps = {
      fireNs: nsWith([{ incident_name: 'X', county: 'Los Angeles', incident_year: '2018', destroyed_count: '5', latitude: '34.03', longitude: '-118.68' }]),
      floodNs: nsWith([{ event_type: 'Flood', county_zone_name: 'LOS ANGELES', year: '2017', damage_property_usd: '0', begin_location: 'MALIBU', begin_latitude: '34.03', begin_longitude: '-118.68' }]),
      quakeNs: nsWith([{ place: 'Near', magnitude: '5.0', event_year: '1975', latitude: '34.03', longitude: '-118.68' }]),
      countyOf: vi.fn().mockResolvedValue('Los Angeles'),
    };
    const res = await getHazardColor(deps, MALIBU, 'Malibu, CA');
    expect(res.items).toHaveLength(3);
    expect(res.context).toContain('Historical hazard events');
    expect(res.context).toContain('[fire]');
    expect(res.context).toContain('[flood]');
    expect(res.context).toContain('[quake]');
  });

  it('skips fire/flood when the county is unknown but still tries quakes', async () => {
    const fireNs = emptyNs();
    const deps = { fireNs, floodNs: emptyNs(), quakeNs: emptyNs(), countyOf: vi.fn().mockResolvedValue(null) };
    const res = await getHazardColor(deps, MALIBU, 'Malibu, CA');
    expect(res.items).toEqual([]);
    expect(res.context).toBe('');
    expect(fireNs.searchRecords).not.toHaveBeenCalled();
  });
});

describe('formatColorContext', () => {
  it('returns an empty string when there are no items', () => {
    expect(formatColorContext([])).toBe('');
  });
});
