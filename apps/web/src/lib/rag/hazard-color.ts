import type { GeoPoint } from '@/lib/risk/types';
import type { PineconeNamespace } from './pinecone-retriever';

export type Hazard = 'fire' | 'flood' | 'quake';

/** One retrieved historical event, as supplementary narrative color (not a rating). */
export interface ColorItem {
  hazard: Hazard;
  summary: string;
  source: string;
}

export interface ColorResult {
  items: ColorItem[];
  /** Formatted block for the LLM narration context (empty when no items). */
  context: string;
}

export interface ColorDeps {
  fireNs: PineconeNamespace;
  floodNs: PineconeNamespace;
  quakeNs: PineconeNamespace;
  countyOf: (point: GeoPoint) => Promise<string | null>;
}

type Fields = Record<string, unknown>;
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => (v == null ? '' : String(v));

/** Integrated-embedding text search over one corpus; never throws (→ []). */
async function search(
  ns: PineconeNamespace,
  text: string,
  topK: number,
  fields: string[],
  filter?: Record<string, unknown>,
): Promise<Fields[]> {
  try {
    const res = await ns.searchRecords({
      query: { inputs: { text }, topK, ...(filter ? { filter } : {}) },
      fields,
    });
    return res.result.hits.map((h) => h.fields as Fields);
  } catch {
    return [];
  }
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface NearOpts {
  maxKm: number;
  limit: number;
  /** Optional grouping key — keep only the nearest row per key (e.g. per incident). */
  dedupBy?: (f: Fields) => string;
}

/** Rank rows by distance to the point, keep the nearest within maxKm (deduped). */
function nearest(
  rows: Fields[],
  point: GeoPoint,
  latKey: string,
  lonKey: string,
  { maxKm, limit, dedupBy }: NearOpts,
): Array<{ f: Fields; km: number }> {
  const ranked = rows
    .map((f) => ({ f, km: haversineKm(point.lat, point.lon, num(f[latKey]), num(f[lonKey])) }))
    .filter((x) => Number.isFinite(x.km) && x.km <= maxKm)
    .sort((a, b) => a.km - b.km);
  if (!dedupBy) return ranked.slice(0, limit);
  const seen = new Set<string>();
  const out: Array<{ f: Fields; km: number }> = [];
  for (const x of ranked) {
    const key = dedupBy(x.f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

const FIRE_FIELDS = ['incident_name', 'county', 'incident_year', 'destroyed_count', 'latitude', 'longitude'];
const FLOOD_FIELDS = ['event_type', 'county_zone_name', 'year', 'damage_property_usd', 'begin_location', 'begin_latitude', 'begin_longitude'];
const QUAKE_FIELDS = ['place', 'magnitude', 'event_year', 'latitude', 'longitude'];

/** CAL FIRE DINS post-fire damage — county-filtered, then the nearest distinct incidents. */
export async function fireColor(ns: PineconeNamespace, county: string, point: GeoPoint, near: string): Promise<ColorItem[]> {
  // Query by the address (carries the city) so the local rows land in the topK-50 cap.
  const hits = await search(ns, `wildfire structure damage near ${near}`, 50, FIRE_FIELDS, {
    county: { $eq: county },
  });
  // DINS stores one row per incident PER CITY, so aggregate each incident's nearby
  // rows (sum destroyed, keep the nearest distance) — otherwise a major fire can be
  // represented by a low-damage edge row and sink in the ranking.
  const incidents = new Map<
    string,
    { name: string; year: string; county: string; destroyed: number; km: number }
  >();
  for (const f of hits) {
    const km = haversineKm(point.lat, point.lon, num(f.latitude), num(f.longitude));
    if (!Number.isFinite(km) || km > 50) continue;
    const name = str(f.incident_name);
    const agg = incidents.get(name);
    if (agg) {
      agg.destroyed += num(f.destroyed_count);
      agg.km = Math.min(agg.km, km);
    } else {
      incidents.set(name, {
        name,
        year: str(f.incident_year),
        county: str(f.county),
        destroyed: num(f.destroyed_count),
        km,
      });
    }
  }
  // Lead with the most destructive nearby incident (most risk-relevant).
  return [...incidents.values()]
    .sort((a, b) => b.destroyed - a.destroyed)
    .slice(0, 3)
    .map((i) => ({
      hazard: 'fire' as const,
      summary: `${i.name} fire (${i.year}, ${i.county} County): ${i.destroyed.toLocaleString('en-US')} structures destroyed, ~${Math.round(i.km)} km away.`,
      source: `CAL FIRE DINS — ${i.name} (${i.county}, ${i.year})`,
    }));
}

/** NOAA Storm Events floods — county-filtered, then the nearest events. */
export async function floodColor(ns: PineconeNamespace, countyUpper: string, point: GeoPoint, near: string): Promise<ColorItem[]> {
  const hits = await search(ns, `flooding near ${near}`, 50, FLOOD_FIELDS, {
    county_zone_name: { $eq: countyUpper },
  });
  return nearest(hits, point, 'begin_latitude', 'begin_longitude', { maxKm: 60, limit: 3 }).map(
    ({ f, km }) => {
      const dmg = num(f.damage_property_usd);
      const kind = str(f.event_type).toLowerCase() || 'flood';
      return {
        hazard: 'flood' as const,
        summary: `${str(f.year)} ${kind} near ${str(f.begin_location)} (~${Math.round(km)} km away)${dmg > 0 ? `, ~$${dmg.toLocaleString('en-US')} property damage` : ''}.`,
        source: `NOAA Storm Events — ${str(f.county_zone_name)} ${kind} (${str(f.year)})`,
      };
    },
  );
}

/** USGS historical quakes have no county — over-fetch, then keep the nearest few. */
export async function quakeColor(ns: PineconeNamespace, point: GeoPoint, near: string): Promise<ColorItem[]> {
  const hits = await search(ns, `historic earthquakes near ${near}`, 50, QUAKE_FIELDS);
  return nearest(hits, point, 'latitude', 'longitude', { maxKm: 120, limit: 3 }).map(({ f, km }) => ({
    hazard: 'quake' as const,
    summary: `M${str(f.magnitude)} earthquake in ${str(f.event_year)} — ${str(f.place)} (~${Math.round(km)} km away).`,
    source: `USGS — M${str(f.magnitude)} ${str(f.place)} (${str(f.event_year)})`,
  }));
}

/** Render the retrieved items as an LLM context block (empty string if none). */
export function formatColorContext(items: ColorItem[]): string {
  if (items.length === 0) return '';
  const lines = items.map((i) => `- [${i.hazard}] ${i.summary}`).join('\n');
  return `Historical hazard events in or near this area (background only — NOT current risk ratings):\n${lines}`;
}

/** Retrieve multi-hazard color for a point: county-filtered fire/flood + nearby quakes, all distance-ranked. */
export async function getHazardColor(deps: ColorDeps, point: GeoPoint, near: string): Promise<ColorResult> {
  const county = await deps.countyOf(point).catch(() => null);
  const [fire, flood, quake] = await Promise.all([
    county ? fireColor(deps.fireNs, county, point, near) : Promise.resolve<ColorItem[]>([]),
    county ? floodColor(deps.floodNs, county.toUpperCase(), point, near) : Promise.resolve<ColorItem[]>([]),
    quakeColor(deps.quakeNs, point, near),
  ]);
  const items = [...fire, ...flood, ...quake];
  return { items, context: formatColorContext(items) };
}
