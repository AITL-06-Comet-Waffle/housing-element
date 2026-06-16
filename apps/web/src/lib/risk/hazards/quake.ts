import type { GeoPoint, QuakeRisk } from '@/lib/risk/types';
import { query, type QueryFn } from '@/lib/risk/db';

// One round-trip: the PGA shaking band (point-in-polygon over the vectorized USGS
// grid) plus whether the point sits in an Alquist-Priolo fault-rupture zone.
const QUAKE_SQL = `
  SELECT
    (SELECT pga_band FROM hazard_pga WHERE ST_Contains(geom, p.pt) LIMIT 1) AS pga_band,
    EXISTS (SELECT 1 FROM hazard_ap_zones WHERE ST_Contains(geom, p.pt)) AS fault_zone
  FROM (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS pt) p
`;

/**
 * Look up earthquake risk for a point: USGS PGA shaking band + Alquist-Priolo
 * fault-rupture membership.
 *
 * @param point WGS84 location to test.
 * @param run   Injectable query executor (tests pass a fake; defaults to the pool).
 * @returns The PGA band (null if outside the grid) and the fault-zone flag.
 */
export async function getQuake(point: GeoPoint, run: QueryFn = query): Promise<QuakeRisk> {
  const { rows } = await run(QUAKE_SQL, [point.lon, point.lat]);
  const row = rows[0];
  return {
    pgaBand: (row?.pga_band as string | null) ?? null,
    faultZone: Boolean(row?.fault_zone),
  };
}
