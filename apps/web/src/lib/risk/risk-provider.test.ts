// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { PostgisRiskProvider, getRiskProvider } from './risk-provider';
import type { FireRisk, FloodRisk, QuakeRisk } from '@/lib/risk/types';

describe('PostgisRiskProvider', () => {
  it('assembles a RiskProfile from the injected fire/flood/quake adapters', async () => {
    const fire: FireRisk = { hazardClass: 'High', responsibilityArea: 'SRA' };
    const flood: FloodRisk = { level: 'High', zone: 'AE' };
    const quake: QuakeRisk = { pgaBand: '0.4-0.6 g', faultZone: false };
    const fireZone = vi.fn().mockResolvedValue(fire);
    const floodZone = vi.fn().mockResolvedValue(flood);
    const quakeFn = vi.fn().mockResolvedValue(quake);
    const provider = new PostgisRiskProvider(fireZone, floodZone, quakeFn);

    const profile = await provider.assess({ lat: 38, lon: -121 });

    expect(profile).toEqual({ fire, flood, quake });
    for (const fn of [fireZone, floodZone, quakeFn]) {
      expect(fn).toHaveBeenCalledWith({ lat: 38, lon: -121 });
    }
  });
});

describe('getRiskProvider', () => {
  it('returns a PostgisRiskProvider', () => {
    expect(getRiskProvider()).toBeInstanceOf(PostgisRiskProvider);
  });
});
