import type { FloodLevel, FloodRisk, GeoPoint } from '@/lib/risk/types';
import { query, type QueryFn } from '@/lib/risk/db';

// Point-in-polygon against FEMA NFHL flood-hazard areas. If a point falls in more
// than one panel (overlap slivers after ST_MakeValid), return the highest level so
// the result never under-reports.
const FLOOD_SQL = `
  SELECT fld_zone, flood_level
  FROM hazard_flood
  WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
  ORDER BY CASE flood_level
             WHEN 'High' THEN 4
             WHEN 'Moderate' THEN 3
             WHEN 'Minimal' THEN 2
             WHEN 'Undetermined' THEN 1
             ELSE 0
           END DESC
  LIMIT 1
`;

const NO_FLOOD: FloodRisk = { level: 'None', zone: null };

/**
 * Look up FEMA flood risk for a point.
 *
 * @param point WGS84 location to test.
 * @param run   Injectable query executor (tests pass a fake; defaults to the pool).
 * @returns The flood level + raw FEMA zone, or `'None'` if in no mapped panel.
 */
export async function getFloodZone(point: GeoPoint, run: QueryFn = query): Promise<FloodRisk> {
  const { rows } = await run(FLOOD_SQL, [point.lon, point.lat]);
  const row = rows[0];
  if (!row) return NO_FLOOD;
  return {
    level: row.flood_level as FloodLevel,
    zone: (row.fld_zone as string | null) ?? null,
  };
}
