import type { GeoPoint } from '@/lib/risk/types';

export type FetchFn = typeof fetch;

const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';

/**
 * Reverse-lookup the California county containing a point, via the Census
 * geographies service. Used to key county-filtered hazard color (fire/flood).
 * Best-effort: returns `null` on any miss or error so color degrades gracefully.
 *
 * @returns Title-case county name without the " County" suffix (e.g. "Butte").
 */
export async function countyForPoint(point: GeoPoint, fetchFn: FetchFn = fetch): Promise<string | null> {
  const url =
    `${ENDPOINT}?x=${point.lon}&y=${point.lat}` +
    `&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { geographies?: { Counties?: Array<{ NAME?: string; BASENAME?: string }> } };
    };
    const county = data.result?.geographies?.Counties?.[0];
    if (!county) return null;
    return county.BASENAME ?? county.NAME?.replace(/ County$/, '') ?? null;
  } catch {
    return null;
  }
}
