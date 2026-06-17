import { describe, it, expect, vi } from 'vitest';
import { countyForPoint } from './county';

const makeFetch = (data: unknown, ok = true): typeof fetch =>
  vi.fn().mockResolvedValue({ ok, json: async () => data } as Response);

describe('countyForPoint', () => {
  it('returns the county BASENAME for a point', async () => {
    const data = { result: { geographies: { Counties: [{ NAME: 'Butte County', BASENAME: 'Butte' }] } } };
    expect(await countyForPoint({ lat: 39.75, lon: -121.6 }, makeFetch(data))).toBe('Butte');
  });

  it('strips " County" when only NAME is present', async () => {
    const data = { result: { geographies: { Counties: [{ NAME: 'Los Angeles County' }] } } };
    expect(await countyForPoint({ lat: 34, lon: -118 }, makeFetch(data))).toBe('Los Angeles');
  });

  it('returns null when no county is found', async () => {
    expect(await countyForPoint({ lat: 0, lon: 0 }, makeFetch({ result: { geographies: {} } }))).toBeNull();
  });

  it('returns null on a non-200 response', async () => {
    expect(await countyForPoint({ lat: 1, lon: 2 }, makeFetch({}, false))).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch;
    expect(await countyForPoint({ lat: 1, lon: 2 }, f)).toBeNull();
  });
});
