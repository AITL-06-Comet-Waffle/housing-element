// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { PostgisRiskProvider, getRiskProvider } from './risk-provider';
import type { FireRisk } from '@/lib/risk/types';

describe('PostgisRiskProvider', () => {
  it('assembles a RiskProfile from the injected fire adapter', async () => {
    const fire: FireRisk = { hazardClass: 'High', responsibilityArea: 'SRA' };
    const fireZone = vi.fn().mockResolvedValue(fire);
    const provider = new PostgisRiskProvider(fireZone);

    const profile = await provider.assess({ lat: 38, lon: -121 });

    expect(profile).toEqual({ fire });
    expect(fireZone).toHaveBeenCalledWith({ lat: 38, lon: -121 });
  });
});

describe('getRiskProvider', () => {
  it('returns a PostgisRiskProvider', () => {
    expect(getRiskProvider()).toBeInstanceOf(PostgisRiskProvider);
  });
});
