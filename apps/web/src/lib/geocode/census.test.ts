import { describe, it, expect, vi } from 'vitest';
import { geocode } from './census';

const CA_MATCH = {
  result: {
    addressMatches: [
      {
        matchedAddress: '1234 PACIFIC COAST HWY, MALIBU, CA, 90265',
        coordinates: { x: -118.4912, y: 34.0195 },
        addressComponents: { state: 'CA' },
      },
    ],
  },
};

const makeFetch = (data: unknown, ok = true): typeof fetch =>
  vi.fn().mockResolvedValue({ ok, json: async () => data } as Response);

describe('geocode', () => {
  it('returns the first match as a point + standardized address for a CA address', async () => {
    const result = await geocode('1234 Pacific Coast Hwy, Malibu CA', makeFetch(CA_MATCH));
    expect(result).toEqual({
      ok: true,
      point: { lat: 34.0195, lon: -118.4912 },
      matched: '1234 PACIFIC COAST HWY, MALIBU, CA, 90265',
    });
  });

  it('queries the Census one-line endpoint with the current benchmark and encoded address', async () => {
    const fetchFn = makeFetch(CA_MATCH);
    await geocode('1 Main St, Davis CA', fetchFn);
    const url = vi.mocked(fetchFn).mock.calls[0][0] as string;
    expect(url).toContain('geocoding.geo.census.gov/geocoder/locations/onelineaddress');
    expect(url).toContain('benchmark=Public_AR_Current');
    expect(url).toContain(encodeURIComponent('1 Main St, Davis CA'));
  });

  it('rejects an out-of-CA match as out_of_state', async () => {
    const data = {
      result: {
        addressMatches: [
          { matchedAddress: 'X', coordinates: { x: -115, y: 36 }, addressComponents: { state: 'NV' } },
        ],
      },
    };
    expect(await geocode('Las Vegas NV', makeFetch(data))).toEqual({ ok: false, reason: 'out_of_state' });
  });

  it('returns no_match when Census finds no addresses', async () => {
    expect(await geocode('asdfqwer', makeFetch({ result: { addressMatches: [] } }))).toEqual({
      ok: false,
      reason: 'no_match',
    });
  });

  it('takes the first match when Census returns several', async () => {
    const data = {
      result: {
        addressMatches: [
          { matchedAddress: 'FIRST', coordinates: { x: -120, y: 38 }, addressComponents: { state: 'CA' } },
          { matchedAddress: 'SECOND', coordinates: { x: -121, y: 39 }, addressComponents: { state: 'CA' } },
        ],
      },
    };
    expect(await geocode('ambiguous', makeFetch(data))).toMatchObject({ ok: true, matched: 'FIRST' });
  });

  it('throws on a non-200 response so the route can answer 500', async () => {
    await expect(geocode('x', makeFetch({}, false))).rejects.toThrow(/Census geocoder responded/);
  });

  it('propagates a network/abort error to the caller', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    await expect(geocode('x', fetchFn)).rejects.toThrow('network down');
  });
});
