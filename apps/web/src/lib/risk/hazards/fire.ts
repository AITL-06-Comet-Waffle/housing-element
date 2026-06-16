import type { FireHazardClass, FireRisk, GeoPoint, ResponsibilityArea } from '@/lib/risk/types';
import { query, type QueryFn } from '@/lib/risk/db';

// Point-in-polygon against the FHSZ layer. ST_MakePoint takes (lon, lat); the layer
// is EPSG:4326. If a point falls in more than one polygon (boundary slivers after
// ST_MakeValid), return the most severe zone so the result never under-reports.
const FIRE_ZONE_SQL = `
  SELECT hazard_class, responsibility_area
  FROM hazard_fhsz
  WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
  ORDER BY CASE hazard_class
             WHEN 'Very High' THEN 3
             WHEN 'High' THEN 2
             WHEN 'Moderate' THEN 1
             ELSE 0
           END DESC
  LIMIT 1
`;

const NO_ZONE: FireRisk = { hazardClass: 'None', responsibilityArea: null };

/**
 * Look up the wildfire (FHSZ) zone containing a point.
 *
 * @param point WGS84 location to test.
 * @param run   Injectable query executor (tests pass a fake; defaults to the pool).
 * @returns The zone's class + responsibility area, or `'None'` if in no polygon.
 */
export async function getFireZone(point: GeoPoint, run: QueryFn = query): Promise<FireRisk> {
  const { rows } = await run(FIRE_ZONE_SQL, [point.lon, point.lat]);
  const row = rows[0];
  if (!row) return NO_ZONE;
  return {
    hazardClass: row.hazard_class as FireHazardClass,
    responsibilityArea: (row.responsibility_area as ResponsibilityArea | null) ?? null,
  };
}
