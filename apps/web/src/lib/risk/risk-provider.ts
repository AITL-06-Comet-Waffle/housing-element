import type { GeoPoint, RiskProfile } from '@/lib/risk/types';
import { getFireZone } from '@/lib/risk/hazards/fire';

/**
 * Seam for all risk lookups. PostGIS spatial joins back it today; a future FastAPI
 * ML service could implement the same interface without touching the route or UI.
 */
export interface RiskProvider {
  assess(point: GeoPoint): Promise<RiskProfile>;
}

/**
 * Risk provider backed by PostGIS point-in-polygon lookups. The hazard adapters are
 * injected, so the provider is unit-testable with fakes (no database).
 */
export class PostgisRiskProvider implements RiskProvider {
  constructor(private readonly fireZone: typeof getFireZone = getFireZone) {}

  async assess(point: GeoPoint): Promise<RiskProfile> {
    return { fire: await this.fireZone(point) };
  }
}

/** Select the risk provider. One implementation today; mirrors getProvider(). */
export function getRiskProvider(): RiskProvider {
  return new PostgisRiskProvider();
}
