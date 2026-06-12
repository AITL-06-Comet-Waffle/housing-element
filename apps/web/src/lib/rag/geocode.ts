export type GeoResult = { lat: number; lon: number; county: string; city: string };

export type FetchFn = typeof fetch;

// Matches patterns like "748 Story Rd, San Jose, CA 95112" within a longer sentence.
const ADDRESS_RE = /\b(\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})\b/i;

export function extractAddress(text: string): string {
  return ADDRESS_RE.exec(text)?.[1]?.trim() ?? text;
}

export async function geocodeAddress(
  query: string,
  userAgent: string,
  fetchFn: FetchFn = fetch,
): Promise<GeoResult | null> {
  try {
    const addressQuery = extractAddress(query);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&addressdetails=1&limit=1&countrycodes=us`;
    console.log('[geocode] query:', addressQuery);
    const res = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
    const data = await res.json() as unknown[];

    console.log('[geocode] Nominatim raw response:', JSON.stringify(data));

    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0] as Record<string, unknown>;
    const addr = first.address as Record<string, string> | undefined;
    if (!addr?.county) {
      console.log('[geocode] No county in address fields:', JSON.stringify(addr));
      return null;
    }

    const county = addr.county.replace(/ County$/, '');
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.neighbourhood ?? addr.hamlet ?? county;

    return {
      lat: parseFloat(first.lat as string),
      lon: parseFloat(first.lon as string),
      county,
      city,
    };
  } catch (err) {
    console.log('[geocode] fetch/parse error:', err);
    return null;
  }
}
