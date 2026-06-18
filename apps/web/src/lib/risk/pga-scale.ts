import type { Severity } from '@/components/HazardCard';

/** Plain-English interpretation of one stored PGA (peak ground acceleration) band. */
export interface PgaExplanation {
  /** Short plain-English shaking rating, e.g. 'High'. A range for the coarse low band. */
  rating: string;
  /** One clause on what that shaking means for a structure (used in the narrative). */
  meaning: string;
  /** UI color tier for the band — kept here so card color and words can't drift apart. */
  severity: Severity;
}

/**
 * Plain-English shaking scale for each stored PGA band.
 *
 * The four bands come from the ingest binning (scripts/ingest/quake_pga.py,
 * BREAKS=[0.2, 0.4, 0.6]). The reference scale has finer tiers below 0.2 g
 * (very low / low / moderate) that this band cannot distinguish, so '< 0.2 g'
 * is described as a RANGE — never a single tier. This explains the computed
 * band; it never introduces or refines a number.
 */
export const PGA_SCALE: Record<string, PgaExplanation> = {
  '< 0.2 g': {
    rating: 'Very low to moderate',
    meaning:
      'light to moderate shaking; damage is unlikely in most buildings, though possible in ' +
      "vulnerable structures at the upper end — this band spans several intensity levels and isn't " +
      'pinned more precisely',
    severity: 'low',
  },
  '0.2-0.4 g': {
    rating: 'High',
    meaning: 'strong shaking; damage is possible, especially in older or un-retrofitted buildings',
    severity: 'moderate',
  },
  '0.4-0.6 g': {
    rating: 'Very high',
    meaning: 'very strong shaking; structural-damage risk increases',
    severity: 'high',
  },
  '>= 0.6 g': {
    rating: 'Severe / extreme',
    meaning: "potentially damaging shaking; a building's age and seismic condition matter a lot",
    severity: 'very-high',
  },
};

/** Plain-English interpretation of a stored PGA band, or a null-data fallback. */
export function explainPga(band: string | null): PgaExplanation {
  return (
    (band ? PGA_SCALE[band] : undefined) ?? {
      rating: 'Unavailable',
      meaning: 'ground-shaking data is unavailable for this location',
      severity: 'unknown',
    }
  );
}
