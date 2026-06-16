import { geocode } from '@/lib/geocode/census';
import { getRiskProvider } from '@/lib/risk/risk-provider';

/**
 * Risk endpoint. Accepts a street address and returns a structured per-hazard
 * profile (fire only in this phase; no narrative yet).
 *
 * Request body: `{ address: string }`
 * Responses (all JSON):
 *  - 200 `{ ok: true, matched, riskProfile }` — assessment for a CA address.
 *  - 200 `{ ok: false, reason }` — geocode miss (`no_match` | `out_of_state`); the
 *    client branches on `ok`, so a miss is a normal, renderable outcome.
 *  - 400 `{ error }` — malformed body / missing address.
 *  - 500 `{ error }` — geocoder or database unavailable.
 *
 * The riskProfile is authoritative and deterministic; the UI renders cards from it.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const address = (body as { address?: unknown }).address;
  if (typeof address !== 'string' || address.trim() === '') {
    return Response.json(
      { error: 'Request body must include a non-empty "address" string.' },
      { status: 400 },
    );
  }

  try {
    const geo = await geocode(address.trim());
    if (!geo.ok) {
      return Response.json({ ok: false, reason: geo.reason });
    }
    const riskProfile = await getRiskProvider().assess(geo.point);
    return Response.json({ ok: true, matched: geo.matched, riskProfile });
  } catch (err) {
    console.error('[api/risk] lookup failed', err);
    return Response.json({ error: 'Risk lookup failed.' }, { status: 500 });
  }
}
