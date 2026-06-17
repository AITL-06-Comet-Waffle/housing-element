import { geocode } from '@/lib/geocode/census';
import { getNarrator } from '@/lib/llm/get-provider';
import { narrate } from '@/lib/llm/narrate';
import { retrieveColor } from '@/lib/rag/build-color';
import { getCachedAssessment, setCachedAssessment } from '@/lib/risk/cache';
import { buildCitations } from '@/lib/risk/citations';
import { getRiskProvider } from '@/lib/risk/risk-provider';
import type { RiskApiResponse } from '@/lib/risk/types';

/**
 * Risk endpoint. Accepts a street address and returns a structured per-hazard
 * profile + a grounded narrative + source citations.
 *
 * Request body: `{ address: string }`
 * Responses (all JSON):
 *  - 200 `{ ok: true, matched, riskProfile, narrative, citations }` — full assessment.
 *  - 200 `{ ok: false, reason }` — geocode miss (`no_match` | `out_of_state`); the
 *    client branches on `ok`, so a miss is a normal, renderable outcome.
 *  - 400 `{ error }` — malformed body / missing address.
 *  - 500 `{ error }` — geocoder or database unavailable.
 *
 * riskProfile values are authoritative and deterministic; the narrative is grounded
 * in them (never fabricated). Results are cached by normalized address — the hazard
 * data is static, so a repeat lookup skips geocode, Pinecone, and the LLM call.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const address = (payload as { address?: unknown }).address;
  if (typeof address !== 'string' || address.trim() === '') {
    return Response.json(
      { error: 'Request body must include a non-empty "address" string.' },
      { status: 400 },
    );
  }

  const cached = getCachedAssessment(address);
  if (cached) return Response.json(cached);

  try {
    const geo = await geocode(address.trim());
    let result: RiskApiResponse;
    if (!geo.ok) {
      result = { ok: false, reason: geo.reason };
    } else {
      const riskProfile = await getRiskProvider().assess(geo.point);
      const color = await retrieveColor(geo.point, geo.matched);
      const narrative = await narrate(riskProfile, geo.matched, getNarrator(), color.context);
      const citations = buildCitations(color.items.map((item) => item.source));
      result = { ok: true, matched: geo.matched, riskProfile, narrative, citations };
    }
    setCachedAssessment(address, result);
    return Response.json(result);
  } catch (err) {
    console.error('[api/risk] lookup failed', err);
    return Response.json({ error: 'Risk lookup failed.' }, { status: 500 });
  }
}
