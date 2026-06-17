// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geocode/census', () => ({ geocode: vi.fn() }));
vi.mock('@/lib/risk/risk-provider', () => ({ getRiskProvider: vi.fn() }));
vi.mock('@/lib/llm/narrate', () => ({ narrate: vi.fn() }));
vi.mock('@/lib/rag/build-color', () => ({ retrieveColor: vi.fn() }));

import { POST } from './route';
import { geocode } from '@/lib/geocode/census';
import { getRiskProvider } from '@/lib/risk/risk-provider';
import { narrate } from '@/lib/llm/narrate';
import { retrieveColor } from '@/lib/rag/build-color';
import { buildCitations } from '@/lib/risk/citations';
import type { RiskProfile } from '@/lib/risk/types';
import type { RiskProvider } from '@/lib/risk/risk-provider';

const geocodeMock = vi.mocked(geocode);
const getRiskProviderMock = vi.mocked(getRiskProvider);
const narrateMock = vi.mocked(narrate);
const retrieveColorMock = vi.mocked(retrieveColor);

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/risk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const FIRE_PROFILE: RiskProfile = {
  fire: { hazardClass: 'Very High', responsibilityArea: 'LRA' },
  flood: { level: 'High', zone: 'AE' },
  quake: { pgaBand: '0.4-0.6 g', faultZone: false },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/risk', () => {
  it('returns the risk profile + standardized address for a CA address', async () => {
    geocodeMock.mockResolvedValue({ ok: true, point: { lat: 34, lon: -118 }, matched: '1 A ST, LA, CA' });
    const assess = vi.fn().mockResolvedValue(FIRE_PROFILE);
    getRiskProviderMock.mockReturnValue({ assess } as RiskProvider);
    retrieveColorMock.mockResolvedValue({
      items: [{ hazard: 'fire', summary: 's', source: 'SRC' }],
      context: 'CTX',
    });
    narrateMock.mockResolvedValue('Grounded risk summary.');

    const res = await POST(postRequest({ address: '1 A St, LA CA' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      matched: '1 A ST, LA, CA',
      riskProfile: FIRE_PROFILE,
      narrative: 'Grounded risk summary.',
      citations: buildCitations(['SRC']),
    });
    expect(assess).toHaveBeenCalledWith({ lat: 34, lon: -118 });
    expect(narrateMock).toHaveBeenCalledWith(FIRE_PROFILE, '1 A ST, LA, CA', null, 'CTX');
  });

  it('returns ok:false with the reason on a geocode miss (no_match)', async () => {
    geocodeMock.mockResolvedValue({ ok: false, reason: 'no_match' });
    const res = await POST(postRequest({ address: 'asdf' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: 'no_match' });
  });

  it('returns ok:false out_of_state for a non-CA address', async () => {
    geocodeMock.mockResolvedValue({ ok: false, reason: 'out_of_state' });
    const res = await POST(postRequest({ address: 'Las Vegas NV' }));
    await expect(res.json()).resolves.toEqual({ ok: false, reason: 'out_of_state' });
  });

  it('does not geocode when address is missing (400)', async () => {
    const res = await POST(postRequest({ not: 'address' }));
    expect(res.status).toBe(400);
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only address with 400', async () => {
    const res = await POST(postRequest({ address: '   ' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unparseable body with 400', async () => {
    const res = await POST(new Request('http://localhost/api/risk', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('answers 500 when the geocoder or database throws', async () => {
    geocodeMock.mockRejectedValue(new Error('census down'));
    const res = await POST(postRequest({ address: '1 A St, LA CA' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Risk lookup failed.' });
  });
});
