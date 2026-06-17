import type { GeoPoint, GeocodeFailureReason } from '@/lib/risk/types';

export type FetchFn = typeof fetch;

export type GeocodeResult =
  | { ok: true; point: GeoPoint; matched: string }
  | { ok: false; reason: GeocodeFailureReason };

const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const BENCHMARK = 'Public_AR_Current';
const TIMEOUT_MS = 8000;

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: { x: number; y: number };
  addressComponents?: { state?: string };
}

/**
 * Geocode a California street address to a point via the US Census Geocoder.
 *
 * Census is TIGER/Line street interpolation: it returns matches (or none) with no
 * rooftop/parcel tier and no confidence score, so the "precision gate" reduces to
 * found-in-CA vs. not. We take the first match and reject anything outside CA.
 *
 * Transport failures (network, non-200, unparseable body) propagate so the route
 * can answer 500; only a genuinely empty or out-of-state result is a graceful
 * `ok:false` that the UI renders as a friendly message.
 *
 * @param address Free-form one-line street address.
 * @param fetchFn Injectable fetch (tests pass a fake; defaults to global fetch).
 * @returns A point + standardized address, or the reason the lookup yielded nothing.
 */
export async function geocode(address: string, fetchFn: FetchFn = fetch): Promise<GeocodeResult> {
  const url =
    `${ENDPOINT}?address=${encodeURIComponent(address)}&benchmark=${BENCHMARK}&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Census geocoder responded ${res.status}`);

    const data = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
    const match = data.result?.addressMatches?.[0];
    if (!match?.coordinates) return { ok: false, reason: 'no_match' };
    if (match.addressComponents?.state !== 'CA') return { ok: false, reason: 'out_of_state' };

    return {
      ok: true,
      point: { lat: match.coordinates.y, lon: match.coordinates.x },
      matched: match.matchedAddress ?? address,
    };
  } finally {
    clearTimeout(timer);
  }
}
