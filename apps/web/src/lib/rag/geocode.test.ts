import { describe, it, expect, vi } from 'vitest';
import { geocodeAddress, extractAddress } from './geocode';

describe('extractAddress', () => {
  it('extracts a full address from a natural language question', () => {
    expect(extractAddress('is 748 Story Rd, San Jose, CA 95112 near fire hazard?')).toBe('748 Story Rd, San Jose, CA 95112');
  });

  it('returns the original text when no address pattern is found', () => {
    expect(extractAddress('what is the fire risk in Malibu?')).toBe('what is the fire risk in Malibu?');
  });

  it('handles mixed case state abbreviation', () => {
    expect(extractAddress('Tell me about 1234 Pacific Coast Hwy, Malibu, ca 90265')).toBe('1234 Pacific Coast Hwy, Malibu, ca 90265');
  });
});

const NOMINATIM_RESPONSE = [
  {
    lat: '34.0195',
    lon: '-118.4912',
    address: {
      county: 'Los Angeles County',
      city: 'Malibu',
    },
  },
];

const makeFetch = (data: unknown, ok = true): typeof fetch =>
  vi.fn().mockResolvedValue({
    ok,
    json: async () => data,
  } as Response);

describe('geocodeAddress', () => {
  it('returns lat/lon/county/city for a valid address', async () => {
    const result = await geocodeAddress('1234 Pacific Coast Hwy, Malibu CA', 'test-agent', makeFetch(NOMINATIM_RESPONSE));
    expect(result).toEqual({ lat: 34.0195, lon: -118.4912, county: 'Los Angeles', city: 'Malibu' });
  });

  it('normalizes "Los Angeles County" to "Los Angeles"', async () => {
    const result = await geocodeAddress('any address', 'test-agent', makeFetch(NOMINATIM_RESPONSE));
    expect(result?.county).toBe('Los Angeles');
  });

  it('uses address.town as fallback when city is missing', async () => {
    const response = [{ lat: '37.0', lon: '-122.0', address: { county: 'Santa Cruz County', town: 'Felton' } }];
    const result = await geocodeAddress('Felton CA', 'test-agent', makeFetch(response));
    expect(result?.city).toBe('Felton');
  });

  it('uses address.village as fallback when city and town are missing', async () => {
    const response = [{ lat: '37.0', lon: '-122.0', address: { county: 'San Mateo County', village: 'Pescadero' } }];
    const result = await geocodeAddress('Pescadero CA', 'test-agent', makeFetch(response));
    expect(result?.city).toBe('Pescadero');
  });

  it('sets User-Agent header from the passed argument', async () => {
    const fetchFn = makeFetch(NOMINATIM_RESPONSE);
    await geocodeAddress('test', 'my-app/1.0', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('nominatim'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': 'my-app/1.0' }) }),
    );
  });

  it('returns null when Nominatim returns an empty array', async () => {
    const result = await geocodeAddress('gibberish', 'test-agent', makeFetch([]));
    expect(result).toBeNull();
  });

  it('returns null when county is missing from the response', async () => {
    const response = [{ lat: '34.0', lon: '-118.0', address: { city: 'Los Angeles' } }];
    const result = await geocodeAddress('some address', 'test-agent', makeFetch(response));
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    const result = await geocodeAddress('some address', 'test-agent', fetchFn);
    expect(result).toBeNull();
  });
});
