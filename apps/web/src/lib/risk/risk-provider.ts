import type { GeoPoint, RiskProfile } from '@/lib/risk/types';
import { getFireZone } from '@/lib/risk/hazards/fire';
import { getFloodZone } from '@/lib/risk/hazards/flood';
import { getQuake } from '@/lib/risk/hazards/quake';

/**
 * Seam for all risk lookups. PostGIS spatial joins back it today; a future FastAPI
 * ML service could implement the same interface without touching the route or UI.
 */
export interface RiskProvider {
  assess(point: GeoPoint): Promise<RiskProfile>;
}

/**
 * Risk provider backed by PostGIS point-in-polygon lookups. The hazard adapters are
 * injected, so the provider is unit-testable with fakes (no database). The three
 * lookups are independent, so they run concurrently.
 */
export class PostgisRiskProvider implements RiskProvider {
  constructor(
    private readonly fireZone: typeof getFireZone = getFireZone,
    private readonly floodZone: typeof getFloodZone = getFloodZone,
    private readonly quake: typeof getQuake = getQuake,
  ) {}

  async assess(point: GeoPoint): Promise<RiskProfile> {
    const [fire, flood, quake] = await Promise.all([
      this.fireZone(point),
      this.floodZone(point),
      this.quake(point),
    ]);
    return { fire, flood, quake };
  }
}

/** Select the risk provider. One implementation today; mirrors getProvider(). */
export function getRiskProvider(): RiskProvider {
  return new PostgisRiskProvider();
}
