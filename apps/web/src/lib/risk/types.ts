/** A WGS84 (EPSG:4326) geographic point. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * CAL FIRE Fire Hazard Severity Zone class. `'None'` means the point falls in no
 * mapped FHSZ polygon — generally lower mapped hazard, but not zero risk (the LLM
 * narration in a later phase explains this; the structured value never overstates).
 */
export type FireHazardClass = 'Very High' | 'High' | 'Moderate' | 'None';

/** Which agency designates the zone: State or Local Responsibility Area. */
export type ResponsibilityArea = 'SRA' | 'LRA';

/** Forward-looking wildfire risk for a point, read from the FHSZ layer. */
export interface FireRisk {
  hazardClass: FireHazardClass;
  /** `null` when `hazardClass` is `'None'` (no polygon, so no jurisdiction). */
  responsibilityArea: ResponsibilityArea | null;
}

/** FEMA flood-zone risk level, derived from the National Flood Hazard Layer. */
export type FloodLevel = 'High' | 'Moderate' | 'Minimal' | 'Undetermined' | 'None';

/** Forward-looking flood risk for a point, from FEMA NFHL flood-hazard areas. */
export interface FloodRisk {
  level: FloodLevel;
  /** Raw FEMA flood zone code (e.g. 'AE', 'VE', 'X'); null if no mapped panel. */
  zone: string | null;
}

/** Earthquake risk: ground shaking (USGS PGA, 2% in 50yr) + surface fault rupture. */
export interface QuakeRisk {
  /** Peak Ground Acceleration band, e.g. '0.4-0.6 g'; null if outside the grid. */
  pgaBand: string | null;
  /** Within a CA Alquist-Priolo Earthquake Fault Zone (surface-rupture hazard). */
  faultZone: boolean;
}

/** Per-hazard risk profile (each hazard at its native scale; no composite). */
export interface RiskProfile {
  fire: FireRisk;
  flood: FloodRisk;
  quake: QuakeRisk;
}

/** Why a geocode did not yield a usable California point. */
export type GeocodeFailureReason = 'no_match' | 'out_of_state';

/**
 * The `POST /api/risk` body on a 200. Either a full assessment or a graceful
 * geocode miss — both are 200 so the client branches on `ok`, not on status.
 * (Malformed requests are 400 and server faults are 500, each `{ error }`.)
 */
export type RiskApiResponse =
  | { ok: true; matched: string; riskProfile: RiskProfile }
  | { ok: false; reason: GeocodeFailureReason };
