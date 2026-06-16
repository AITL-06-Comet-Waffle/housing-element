import type { LLMProvider, Message } from '@/lib/llm/types';
import type { FireRisk, FloodRisk, QuakeRisk, RiskProfile } from '@/lib/risk/types';

// --- Deterministic template narrative -------------------------------------
// Grounded by construction (uses only the computed values). Serves as the
// baseline when no LLM is configured and as the graceful-degradation fallback.

function fireSentence(fire: FireRisk): string {
  if (fire.hazardClass === 'None') {
    return 'Wildfire: this address is not within a mapped CAL FIRE Fire Hazard Severity Zone (FHSZ) — generally lower mapped wildfire hazard, though not zero.';
  }
  const area =
    fire.responsibilityArea === 'SRA'
      ? ' (State Responsibility Area)'
      : fire.responsibilityArea === 'LRA'
        ? ' (Local Responsibility Area)'
        : '';
  return `Wildfire: CAL FIRE maps this address as a ${fire.hazardClass} Fire Hazard Severity Zone${area}.`;
}

function floodSentence(flood: FloodRisk): string {
  const zone = flood.zone ? ` (FEMA Zone ${flood.zone})` : '';
  switch (flood.level) {
    case 'High':
      return `Flood: this address is in a FEMA Special Flood Hazard Area${zone} — a 1%-annual-chance (100-year) floodplain, where flood insurance is typically required.`;
    case 'Moderate':
      return `Flood: this address is in a moderate-risk flood area${zone} (0.2%-annual-chance / 500-year).`;
    case 'Minimal':
      return `Flood: FEMA maps this address as minimal flood risk${zone}.`;
    case 'Undetermined':
      return `Flood: FEMA has not determined the flood hazard here${zone}.`;
    default:
      return 'Flood: no FEMA flood mapping is available for this address.';
  }
}

function quakeSentence(quake: QuakeRisk): string {
  const shaking = quake.pgaBand
    ? `expected peak ground acceleration is ${quake.pgaBand} (USGS, 2% chance in 50 years)`
    : 'ground-shaking data is unavailable for this location';
  const fault = quake.faultZone
    ? ', and it lies within an Alquist-Priolo Earthquake Fault Zone, where surface fault rupture is a regulated hazard'
    : ', and it is not within a mapped Alquist-Priolo fault-rupture zone';
  return `Earthquake: ${shaking}${fault}.`;
}

/** A grounded prose summary built entirely from the computed risk values. */
export function templateNarrative(profile: RiskProfile, matched: string): string {
  const body = [
    fireSentence(profile.fire),
    floodSentence(profile.flood),
    quakeSentence(profile.quake),
  ].join(' ');
  return `Risk summary for ${matched}. ${body} These are mapped, forward-looking hazard ratings — confirm details with the seller's natural-hazard disclosure, a flood-insurance quote, and a licensed inspector before purchase.`;
}

// --- LLM narration ---------------------------------------------------------

/** The single user message handed to the LLM: the facts + a no-invention instruction. */
export function buildNarrationMessages(profile: RiskProfile, matched: string): Message[] {
  const facts = JSON.stringify({ address: matched, ...profile }, null, 2);
  return [
    {
      role: 'user',
      content:
        'Write a brief, grounded wildfire/flood/earthquake risk evaluation for this California ' +
        'address. Use ONLY these computed values — never invent, estimate, or change a number. ' +
        `Explain what each rating means, then give 2-3 concrete next steps.\n\n${facts}`,
    },
  ];
}

/**
 * Produce a grounded narrative for a risk profile.
 *
 * With no LLM (`null`), or if the LLM errors or returns nothing, returns the
 * deterministic {@link templateNarrative}. Otherwise returns the LLM's prose.
 */
export async function narrate(
  profile: RiskProfile,
  matched: string,
  llm: LLMProvider | null,
): Promise<string> {
  if (!llm) return templateNarrative(profile, matched);
  try {
    const out = (await llm.generate(buildNarrationMessages(profile, matched))).trim();
    return out || templateNarrative(profile, matched);
  } catch {
    return templateNarrative(profile, matched);
  }
}
